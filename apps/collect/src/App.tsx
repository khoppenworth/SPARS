import React, { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import {
  getKv, setKv, savePackage, listPackages, saveDraftVisit, listDraftVisits,
  getDraftVisit, getPackage, enqueueSync, listSyncQueue, removeSyncItem
} from './db';

const API_BASE = (import.meta as any).env.VITE_API_BASE || '/api/v1';

async function api(path: string, jwt: string, init?: RequestInit) {
  const resp = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.message || `HTTP ${resp.status}`);
  return data;
}

type AnswerMap = Record<string, any>;

function getQuestionValue(values: AnswerMap, code: string): any {
  return values[code]?.value ?? null;
}

function evalRuleExpr(expr: any, values: AnswerMap): boolean {
  if (!expr || typeof expr !== 'object' || !expr.op) return false;
  const getRef = (ref: any) => {
    if (ref && typeof ref === 'object' && ref.q) return getQuestionValue(values, ref.q);
    return ref;
  };
  switch (expr.op) {
    case 'eq': return getRef(expr.left) === getRef(expr.right);
    case 'ne': return getRef(expr.left) !== getRef(expr.right);
    case 'and': return Array.isArray(expr.args) && expr.args.every((e: any) => evalRuleExpr(e, values));
    case 'or': return Array.isArray(expr.args) && expr.args.some((e: any) => evalRuleExpr(e, values));
    case 'not': return !evalRuleExpr(expr.arg, values);
    default: return false;
  }
}

function computeHiddenSet(pkg: any, values: AnswerMap): Set<string> {
  const hidden = new Set<string>();
  const rules = pkg?.logicRules || [];
  for (const rule of rules) {
    if (!evalRuleExpr(rule.trigger, values)) continue;
    const actions = Array.isArray(rule.actions) ? rule.actions : [];
    for (const a of actions) {
      if (a.action === 'hide') {
        if (a.target?.questionCode) hidden.add(`q:${a.target.questionCode}`);
        if (a.target?.sectionCode) hidden.add(`s:${a.target.sectionCode}`);
      }
    }
  }
  return hidden;
}

export default function App() {
  const [jwt, setJwt] = useState('');
  const [uiLocale, setUiLocale] = useState(localStorage.getItem('collectUiLocale') || 'en');

  useEffect(() => { getKv<string>('jwt').then(v => v && setJwt(v)); }, []);
  const saveJwt = async (v: string) => { setJwt(v); await setKv('jwt', v); };

  return (
    <div style={{ fontFamily:'system-ui', padding:16, maxWidth:1180, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h1>SPARS Collector (Step 9)</h1>
        <div>
          <label style={{ marginRight: 8 }}>UI locale</label>
          <select value={uiLocale} onChange={e => { localStorage.setItem('collectUiLocale', e.target.value); setUiLocale(e.target.value); }}>
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </div>
      </div>

      <nav style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <Link to='/'>Home</Link>
        <Link to='/assigned'>Assigned Tools</Link>
        <Link to='/packages'>Local Packages</Link>
        <Link to='/drafts'>Draft Visits</Link>
        <Link to='/sync'>Sync Queue</Link>
      </nav>

      <Routes>
        <Route path='/' element={<Home jwt={jwt} saveJwt={saveJwt} />} />
        <Route path='/assigned' element={<AssignedTools jwt={jwt} uiLocale={uiLocale} />} />
        <Route path='/packages' element={<Packages />} />
        <Route path='/drafts' element={<Drafts />} />
        <Route path='/sync' element={<SyncQueue jwt={jwt} />} />
        <Route path='/fill/:toolVersionId' element={<FillForm uiLocale={uiLocale} />} />
      </Routes>
    </div>
  );
}

function Home({ jwt, saveJwt }: any) {
  const [v, setV] = useState(jwt);
  return (
    <div>
      <h2>JWT</h2>
      <p>Temporary scaffold: paste JWT here. Next step should replace this with a real Google Sign-In button.</p>
      <textarea rows={5} value={v} onChange={e=>setV(e.target.value)} style={{ width:'100%' }} />
      <button onClick={()=>saveJwt(v.trim())} style={{ marginTop:8 }}>Save</button>
    </div>
  );
}

function AssignedTools({ jwt, uiLocale }: { jwt: string; uiLocale: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  const load = async () => {
    setErr('');
    try {
      const data = await api('/collector/assigned-tools', jwt);
      setItems(data);
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  useEffect(() => { if (jwt) load(); }, [jwt]);

  const downloadPkg = async (toolVersionId: string) => {
    setBusy(toolVersionId);
    setErr('');
    try {
      const pkg = await api(`/collector/tool-versions/${toolVersionId}/package-localized?locale=${encodeURIComponent(uiLocale)}`, jwt);
      await savePackage(toolVersionId, pkg);
      alert('Package saved locally.');
    } catch (e: any) { setErr(e.message || String(e)); }
    finally { setBusy(''); }
  };

  return (
    <div>
      <h2>Assigned Tools</h2>
      <button onClick={load} disabled={!jwt}>Refresh</button>
      {!jwt && <p style={{ color:'#999' }}>Set JWT first.</p>}
      {err && <p style={{ color:'crimson' }}>{err}</p>}
      <div style={{ display:'grid', gap:12, marginTop:12 }}>
        {items.map(it => (
          <div key={`${it.orgId}-${it.toolId}`} style={{ border:'1px solid #ddd', borderRadius:8, padding:12 }}>
            <div><b>{it.toolName}</b> ({it.toolCode})</div>
            <div style={{ color:'#666' }}>{it.orgName}</div>
            <div>Latest published: {it.latestPublishedVersionLabel || 'none'} / ID: {it.latestPublishedVersionId || 'n/a'}</div>
            <button style={{ marginTop:8 }} disabled={!it.latestPublishedVersionId || busy===it.latestPublishedVersionId} onClick={()=>downloadPkg(it.latestPublishedVersionId)}>
              {busy===it.latestPublishedVersionId ? 'Downloading...' : 'Download Localized Package'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Packages() {
  const [items, setItems] = useState<any[]>([]);
  const nav = useNavigate();
  const load = async () => setItems(await listPackages());
  useEffect(() => { load(); }, []);
  return (
    <div>
      <h2>Local Packages</h2>
      <button onClick={load}>Refresh</button>
      <div style={{ display:'grid', gap:12, marginTop:12 }}>
        {items.map(it => (
          <div key={it.toolVersionId} style={{ border:'1px solid #ddd', borderRadius:8, padding:12 }}>
            <div><b>{it.pkg.tool.name}</b> v{it.pkg.toolVersion.versionLabel}</div>
            <div>Locale: {it.pkg.locale}</div>
            <div>Saved: {it.savedAt}</div>
            <button style={{ marginTop:8 }} onClick={()=>nav(`/fill/${it.toolVersionId}`)}>Open Form</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Drafts() {
  const [items, setItems] = useState<any[]>([]);
  const nav = useNavigate();
  const load = async () => setItems(await listDraftVisits());
  useEffect(() => { load(); }, []);
  return (
    <div>
      <h2>Draft Visits</h2>
      <button onClick={load}>Refresh</button>
      <div style={{ display:'grid', gap:12, marginTop:12 }}>
        {items.map(it => (
          <div key={it.localId} style={{ border:'1px solid #ddd', borderRadius:8, padding:12 }}>
            <div><b>{it.title}</b></div>
            <div style={{ color:'#666' }}>ToolVersionId: {it.toolVersionId}</div>
            <div>Last saved: {it.updatedAt}</div>
            <div>Status: {it.syncState?.submitted ? 'Submitted' : it.syncState?.synced ? 'Synced' : 'Local only'}</div>
            <button style={{ marginTop:8 }} onClick={()=>nav(`/fill/${it.toolVersionId}?draft=${encodeURIComponent(it.localId)}`)}>Resume</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SyncQueue({ jwt }: { jwt: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const load = async () => setItems(await listSyncQueue());
  useEffect(() => { load(); }, []);
  const retryOne = async (item: any) => {
    setErr('');
    try {
      if (!jwt) throw new Error('JWT missing');
      if (item.kind === 'syncResponses') {
        await api(`/collector/visits/${item.serverVisitId}/responses/batch`, jwt, {
          method: 'POST',
          body: JSON.stringify({ items: item.items }),
        });
      } else if (item.kind === 'submitVisit') {
        await api(`/collector/visits/${item.serverVisitId}/submit`, jwt, {
          method: 'POST',
          body: JSON.stringify({}),
        });
      }
      await removeSyncItem(item.id);
      await load();
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  };
  return (
    <div>
      <h2>Sync Queue</h2>
      <button onClick={load}>Refresh</button>
      {err && <p style={{ color:'crimson' }}>{err}</p>}
      <div style={{ display:'grid', gap:12, marginTop:12 }}>
        {items.map(it => (
          <div key={it.id} style={{ border:'1px solid #ddd', borderRadius:8, padding:12 }}>
            <div><b>{it.kind}</b></div>
            <div>Queued: {it.queuedAt}</div>
            <div>Server visit: {it.serverVisitId || 'n/a'}</div>
            <button style={{ marginTop:8 }} onClick={()=>retryOne(it)}>Retry</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FillForm({ uiLocale }: { uiLocale: string }) {
  const { toolVersionId } = useParams();
  const nav = useNavigate();
  const [pkg, setPkg] = useState<any>(null);
  const [draftId, setDraftId] = useState('');
  const [values, setValues] = useState<Record<string, any>>({});
  const [naFlags, setNaFlags] = useState<Record<string, boolean>>({});
  const [naReasons, setNaReasons] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState({ title: '', orgId: '1', facilityId: '1', visitDate: new Date().toISOString().slice(0,10) });
  const [jwt, setJwt] = useState('');
  const [err, setErr] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [syncState, setSyncState] = useState<any>({ serverVisitId: null, synced: false, submitted: false, lastMessage: '' });
  const [sectionIndex, setSectionIndex] = useState(0);

  useEffect(() => { getKv<string>('jwt').then(v => v && setJwt(v)); }, []);

  useEffect(() => {
    const load = async () => {
      const p = await getPackage(toolVersionId!);
      if (!p) { setErr('Package not found locally. Download it first.'); return; }
      setPkg(p.pkg);

      const params = new URLSearchParams(window.location.search);
      const draft = params.get('draft');
      if (draft) {
        const d = await getDraftVisit(draft);
        if (d) {
          setDraftId(d.localId);
          setMeta(d.meta);
          setValues(d.values || {});
          setNaFlags(d.naFlags || {});
          setNaReasons(d.naReasons || {});
          setSyncState(d.syncState || { serverVisitId: null, synced: false, submitted: false, lastMessage: '' });
          setSectionIndex(d.sectionIndex || 0);
        }
      } else {
        const id = `draft-${toolVersionId}-${Date.now()}`;
        setDraftId(id);
        setMeta(m => ({ ...m, title: `${p.pkg.tool.name} visit` }));
      }
    };
    load();
  }, [toolVersionId]);

  const hiddenSet = useMemo(() => computeHiddenSet(pkg, values), [pkg, values]);

  const sections = useMemo(() => {
    if (!pkg) return [];
    const out: any[] = [];
    for (const form of pkg.forms || []) {
      for (const section of form.sections || []) {
        if (hiddenSet.has(`s:${section.code}`)) continue;
        const questions = (section.questions || []).filter((q: any) => !hiddenSet.has(`q:${q.code}`));
        out.push({
          formName: form.name,
          id: section.id,
          code: section.code,
          title: section.title,
          questions,
        });
      }
    }
    return out;
  }, [pkg, hiddenSet]);

  const currentSection = sections[sectionIndex] || null;
  const totalQuestions = sections.reduce((n, s) => n + (s.questions?.length || 0), 0);
  const answeredQuestions = sections.reduce((n, s) => n + (s.questions || []).filter((q: any) => {
    const isNa = !!naFlags[q.code];
    const val = values[q.code];
    return isNa || (val !== undefined && val !== null && val?.value !== '' && val?.value !== undefined);
  }).length, 0);

  const setVal = (code: string, v: any) => setValues(prev => ({ ...prev, [code]: v }));
  const setNa = (code: string, v: boolean) => setNaFlags(prev => ({ ...prev, [code]: v }));
  const setNaReason = (code: string, v: string) => setNaReasons(prev => ({ ...prev, [code]: v }));

  const saveDraft = async (overrideSync?: any) => {
    if (!pkg || !draftId) return;
    const title = meta.title || `${pkg.tool.name} visit`;
    await saveDraftVisit({
      localId: draftId,
      toolVersionId,
      title,
      meta,
      values,
      naFlags,
      naReasons,
      sectionIndex,
      syncState: overrideSync ?? syncState,
      updatedAt: new Date().toISOString(),
    });
  };

  const validateSection = () => {
    if (!currentSection) return [];
    const errs: string[] = [];
    for (const q of currentSection.questions || []) {
      const isNa = !!naFlags[q.code];
      const val = values[q.code];
      const isEmpty = val === undefined || val === null || val?.value === '' || val?.value === undefined || false;
      if (q.allowNA && isNa && q.naRequiresReason && !naReasons[q.code]) {
        errs.push(`${q.label}: NA reason is required`);
      }
      if (q.requiredDefault && !isNa) {
        const empty = val === undefined || val === null || val?.value === '' || val?.value === undefined || (Array.isArray(val?.value) && val.value.length === 0);
        if (empty) errs.push(`${q.label}: required`);
      }
    }
    return errs;
  };

  const goNext = async () => {
    const errs = validateSection();
    setValidationErrors(errs);
    if (errs.length) return;
    await saveDraft();
    setSectionIndex(i => Math.min(i + 1, sections.length - 1));
  };

  const goPrev = async () => {
    await saveDraft();
    setSectionIndex(i => Math.max(i - 1, 0));
  };

  const buildResponseItems = () => {
    const items: any[] = [];
    for (const section of sections) {
      for (const q of section.questions || []) {
        const current = values[q.code];
        const isNa = !!naFlags[q.code];
        if (current === undefined && !isNa) continue;
        items.push({
          questionId: q.id,
          answerJson: isNa ? null : (current ?? null),
          isNa,
          naReason: isNa ? (naReasons[q.code] || null) : null,
          isHidden: false,
        });
      }
    }
    return items;
  };

  const syncToServer = async () => {
    if (!jwt) { setErr('JWT missing. Save JWT on Home first.'); return; }
    if (!pkg) { setErr('No local package loaded.'); return; }

    const errs = validateSection();
    setValidationErrors(errs);
    if (errs.length) return;

    try {
      setErr('');
      let serverVisitId = syncState.serverVisitId;
      if (!serverVisitId) {
        const created = await api('/collector/visits', jwt, {
          method: 'POST',
          body: JSON.stringify({
            orgId: meta.orgId,
            toolVersionId,
            facilityId: meta.facilityId,
            visitDate: meta.visitDate,
          }),
        });
        serverVisitId = created.visitId;
      }

      const items = buildResponseItems();
      try {
        await api(`/collector/visits/${serverVisitId}/responses/batch`, jwt, {
          method: 'POST',
          body: JSON.stringify({ items }),
        });
      } catch (e: any) {
        await enqueueSync({
          id: `sync-${serverVisitId}-${Date.now()}`,
          kind: 'syncResponses',
          serverVisitId,
          items,
          queuedAt: new Date().toISOString(),
        });
        throw e;
      }

      const nextSync = {
        serverVisitId,
        synced: true,
        submitted: false,
        lastMessage: `Synced ${items.length} responses`,
      };
      setSyncState(nextSync);
      await saveDraft(nextSync);
      alert(nextSync.lastMessage);
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  };

  const submitToServer = async () => {
    if (!jwt) { setErr('JWT missing. Save JWT on Home first.'); return; }
    const errs = validateSection();
    setValidationErrors(errs);
    if (errs.length) return;

    try {
      setErr('');
      let current = syncState;
      if (!current.serverVisitId || !current.synced) {
        await syncToServer();
        const reloaded = await getDraftVisit(draftId);
        current = reloaded?.syncState || current;
      }
      if (!current.serverVisitId) throw new Error('Server visit not available after sync');

      try {
        const result = await api(`/collector/visits/${current.serverVisitId}/submit`, jwt, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        const nextSync = {
          serverVisitId: current.serverVisitId,
          synced: true,
          submitted: true,
          lastMessage: `Submitted. Indicators computed: ${result.computedIndicators ?? 0}`,
        };
        setSyncState(nextSync);
        await saveDraft(nextSync);
        alert(nextSync.lastMessage);
      } catch (e: any) {
        await enqueueSync({
          id: `submit-${current.serverVisitId}-${Date.now()}`,
          kind: 'submitVisit',
          serverVisitId: current.serverVisitId,
          queuedAt: new Date().toISOString(),
        });
        throw e;
      }
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  };

  const progress = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;

  return (
    <div>
      <h2>Fill Form</h2>
      {err && <p style={{ color:'crimson' }}>{err}</p>}
      {validationErrors.length > 0 && (
        <div style={{ border:'1px solid crimson', borderRadius:8, padding:12, background:'#fff5f5', marginBottom:12 }}>
          <b>Fix these before continuing:</b>
          <ul>
            {validationErrors.map((v, i) => <li key={i}>{v}</li>)}
          </ul>
        </div>
      )}

      {!pkg ? <p>Loading local package...</p> : (
        <>
          <div style={{ border:'1px solid #ddd', borderRadius:8, padding:12, marginBottom:16 }}>
            <div><b>{pkg.tool.name}</b> v{pkg.toolVersion.versionLabel}</div>
            <div>Package locale: {pkg.locale} | UI locale: {uiLocale}</div>
            <div>Server visit: {syncState.serverVisitId || 'not created'}</div>
            <div>Status: {syncState.submitted ? 'Submitted' : syncState.synced ? 'Synced' : 'Local draft only'}</div>
            <div style={{ color:'#666' }}>{syncState.lastMessage}</div>
            <div style={{ marginTop: 8 }}>Progress: {answeredQuestions}/{totalQuestions} ({progress}%)</div>
            <div style={{ height: 10, background:'#eee', borderRadius: 8, overflow:'hidden', marginTop: 6 }}>
              <div style={{ width: `${progress}%`, background:'#666', height:'100%' }} />
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
              <input value={meta.title} onChange={e=>setMeta({ ...meta, title: e.target.value })} placeholder='Draft title' style={{ minWidth: 220 }} />
              <input value={meta.orgId} onChange={e=>setMeta({ ...meta, orgId: e.target.value })} placeholder='orgId' style={{ width: 100 }} />
              <input value={meta.facilityId} onChange={e=>setMeta({ ...meta, facilityId: e.target.value })} placeholder='facilityId' style={{ width: 120 }} />
              <input type='date' value={meta.visitDate} onChange={e=>setMeta({ ...meta, visitDate: e.target.value })} />
              <button onClick={()=>saveDraft()}>Save Draft</button>
              <button onClick={syncToServer}>Sync to Server</button>
              <button onClick={submitToServer}>Submit to Server</button>
              <button onClick={()=>nav('/drafts')}>Back to Drafts</button>
            </div>
          </div>

          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            {sections.map((s, i) => (
              <button key={s.id} onClick={()=>setSectionIndex(i)} style={{ fontWeight: i === sectionIndex ? 700 : 400 }}>
                {i + 1}. {s.title}
              </button>
            ))}
          </div>

          {currentSection ? (
            <div>
              <h3>{currentSection.formName}</h3>
              <h4>{currentSection.title}</h4>
              <div style={{ display:'grid', gap:12 }}>
                {currentSection.questions.map((item: any) => {
                  const val = values[item.code];
                  const isNa = !!naFlags[item.code];
                  return (
                    <div key={item.id} style={{ border:'1px solid #eee', borderRadius:8, padding:12 }}>
                      <div style={{ fontWeight: 600 }}>{item.label}</div>
                      {item.helpText ? <div style={{ color:'#666', fontSize: 13, marginTop: 4 }}>{item.helpText}</div> : null}
                      <div style={{ marginTop: 8 }}>
                        {renderQuestionInput(item, val, (v:any)=>setVal(item.code, v))}
                      </div>
                      {item.allowNA && (
                        <div style={{ marginTop: 8 }}>
                          <label>
                            <input type='checkbox' checked={isNa} onChange={e=>setNa(item.code, e.target.checked)} /> Mark as N/A
                          </label>
                        </div>
                      )}
                      {item.allowNA && isNa && (
                        <div style={{ marginTop: 8 }}>
                          <input value={naReasons[item.code] || ''} onChange={e=>setNaReason(item.code, e.target.value)} placeholder='NA reason' style={{ width:'100%' }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display:'flex', gap:8, marginTop:16 }}>
                <button onClick={goPrev} disabled={sectionIndex === 0}>Previous Section</button>
                <button onClick={goNext} disabled={sectionIndex >= sections.length - 1}>Next Section</button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function renderQuestionInput(item: any, val: any, onChange: (v:any)=>void) {
  const t = item.type;
  if (t === 'boolean') {
    return (
      <select value={val?.value === true ? 'true' : val?.value === false ? 'false' : ''} onChange={e=>onChange(e.target.value === '' ? null : { value: e.target.value === 'true' })}>
        <option value=''>-- select --</option>
        <option value='true'>Yes</option>
        <option value='false'>No</option>
      </select>
    );
  }
  if (t === 'text' || t === 'textarea') {
    return <textarea rows={t === 'textarea' ? 4 : 2} value={val?.value ?? ''} onChange={e=>onChange({ value: e.target.value })} style={{ width:'100%' }} />;
  }
  if (t === 'number' || t === 'decimal') {
    return <input type='number' value={val?.value ?? ''} onChange={e=>onChange({ value: Number(e.target.value) })} />;
  }
  if (t === 'date') {
    return <input type='date' value={val?.value ?? ''} onChange={e=>onChange({ value: e.target.value })} />;
  }
  if (t === 'single_select') {
    return (
      <select value={val?.value ?? ''} onChange={e=>onChange({ value: e.target.value })}>
        <option value=''>-- select --</option>
        {(item.options || []).sort((a:any,b:any)=>a.sortOrder-b.sortOrder).map((o:any) => (
          <option key={o.id} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }
  if (t === 'multi_select') {
    const selected = Array.isArray(val?.value) ? val.value : [];
    return (
      <div>
        {(item.options || []).sort((a:any,b:any)=>a.sortOrder-b.sortOrder).map((o:any) => (
          <label key={o.id} style={{ display:'block' }}>
            <input
              type='checkbox'
              checked={selected.includes(o.value)}
              onChange={e => {
                const next = e.target.checked ? [...selected, o.value] : selected.filter((x:any) => x !== o.value);
                onChange({ value: next });
              }}
            /> {o.label}
          </label>
        ))}
      </div>
    );
  }
  if (t === 'grid') {
    const rows = Array.isArray(item.constraints?.rows) ? item.constraints.rows : ['row1', 'row2'];
    const cols = Array.isArray(item.constraints?.cols) ? item.constraints.cols : ['col1', 'col2'];
    const current = val?.value || {};
    return (
      <table style={{ borderCollapse:'collapse', width:'100%' }}>
        <thead>
          <tr>
            <th style={{ border:'1px solid #ccc', padding:6 }}></th>
            {cols.map((c:any) => <th key={c} style={{ border:'1px solid #ccc', padding:6 }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r:any) => (
            <tr key={r}>
              <td style={{ border:'1px solid #ccc', padding:6 }}>{r}</td>
              {cols.map((c:any) => (
                <td key={`${r}-${c}`} style={{ border:'1px solid #ccc', padding:6 }}>
                  <input
                    value={current?.[r]?.[c] ?? ''}
                    onChange={e => {
                      const next = { ...(current || {}) };
                      next[r] = { ...(next[r] || {}), [c]: e.target.value };
                      onChange({ value: next });
                    }}
                    style={{ width:'100%' }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return <input value={val?.value ?? ''} onChange={e=>onChange({ value: e.target.value })} />;
}
