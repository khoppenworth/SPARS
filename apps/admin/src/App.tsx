import React, { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
const API_BASE = (import.meta as any).env.VITE_API_BASE || '/api/v1';

async function apiGet(path: string, jwt: string) {
  const resp = await fetch(`${API_BASE}${path}`, { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} });
  const data = await resp.json().catch(()=>({}));
  if (!resp.ok) throw new Error(data?.message || `HTTP ${resp.status}`);
  return data;
}


function apiPost(path: string, jwt: string, body: any) {
  return fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const data = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(data?.message || `HTTP ${r.status}`);
    return data;
  });
}

export default function App() {
  const [jwt, setJwt] = useState(localStorage.getItem('jwt') || '');
  const [uiLocale, setUiLocale] = useState(localStorage.getItem('uiLocale') || 'en');
  const [me, setMe] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(()=>{ if(!jwt) return; apiGet('/me', jwt).then(setMe).catch(e=>setErr(String(e.message||e))); }, [jwt]);

  const save = (v: string) => { localStorage.setItem('jwt', v); setJwt(v); };
  const logout = () => { localStorage.removeItem('jwt'); setJwt(''); setMe(null); };

  return (
    <div style={{ fontFamily:'system-ui', padding:24, maxWidth:1000, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h1>SPARS Admin</h1>
        <div>
          <label style={{ marginRight: 8 }}>UI locale</label>
          <select value={uiLocale} onChange={e => { localStorage.setItem('uiLocale', e.target.value); setUiLocale(e.target.value); }}>
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </div>
      </div>
      <nav style={{ display:'flex', gap:12, marginBottom:16 }}>
        <Link to='/'>Home</Link>
        <Link to='/tools'>Tools</Link>
        <Link to='/users'>Users</Link>
        <Link to='/builder'>Builder</Link>
        <a href='/api/docs' target='_blank' rel='noreferrer'>API Docs</a>
      </nav>
      <Routes>
        <Route path='/' element={<Home jwt={jwt} save={save} logout={logout} me={me} err={err} />} />
        <Route path='/tools' element={<Tools jwt={jwt} />} />
        <Route path='/users' element={<Users jwt={jwt} />} />
        <Route path='/builder' element={<Builder jwt={jwt} uiLocale={uiLocale} />} />
      </Routes>
    </div>
  );
}

function Home({ jwt, save, logout, me, err }: any) {
  const [v, setV] = useState(jwt);
  return (
    <div>
      {!jwt ? (
        <>
          <h2>Login</h2>
          <p>Paste API JWT here (scaffold). In production, implement Google Sign-In and call <code>/auth/google</code>.</p>
          <textarea rows={5} value={v} onChange={e=>setV(e.target.value)} style={{ width:'100%' }} />
          <button onClick={()=>save(v.trim())} style={{ marginTop:8 }}>Save JWT</button>
        </>
      ) : (
        <>
          <button onClick={logout}>Logout</button>
          {err && <p style={{ color:'crimson' }}>{err}</p>}
          <pre style={{ background:'#f6f6f6', padding:12, borderRadius:8, overflowX:'auto' }}>{JSON.stringify(me, null, 2)}</pre>
        </>
      )}
    </div>
  );
}

function Tools({ jwt }: { jwt: string }) {
  const [orgId, setOrgId] = useState('1');
  const [tools, setTools] = useState<any[]>([]);
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [err, setErr] = useState('');

  const [newToolName, setNewToolName] = useState('SPARS Tool');
  const [newToolCode, setNewToolCode] = useState('SPARS');
  const [defaultLocale, setDefaultLocale] = useState('en');
  const [enabledLocales, setEnabledLocales] = useState('en,fr');

  const [versionLabel, setVersionLabel] = useState('2.0');

  const loadTools = async () => {
    setErr('');
    try {
      const data = await apiGet(`/orgs/${orgId}/tools`, jwt);
      setTools(data);
      setSelectedTool(null);
      setVersions([]);
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const createTool = async () => {
    setErr('');
    try {
      await apiPost(`/orgs/${orgId}/tools`, jwt, {
        name: newToolName,
        code: newToolCode,
        defaultLocale,
        enabledLocales: enabledLocales.split(',').map(s=>s.trim()).filter(Boolean),
      });
      await loadTools();
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const loadVersions = async (tool: any) => {
    setErr('');
    try {
      setSelectedTool(tool);
      const data = await apiGet(`/orgs/${orgId}/tools/${tool.id}/versions`, jwt);
      setVersions(data);
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const createDraft = async () => {
    if (!selectedTool) return;
    setErr('');
    try {
      await apiPost(`/orgs/${orgId}/tools/${selectedTool.id}/versions`, jwt, { versionLabel });
      await loadVersions(selectedTool);
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const publish = async (v: any) => {
    if (!selectedTool) return;
    setErr('');
    try {
      await apiPost(`/orgs/${orgId}/tools/${selectedTool.id}/versions/${v.id}/publish`, jwt, {});
      await loadVersions(selectedTool);
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  return (
    <div>
      <h2>Tools & Versions</h2>
      <p style={{ color:'#555' }}>
        Step 2: Tool CRUD, draft versions, publish. Requires <code>tool.write</code> and <code>tool.publish</code>.
      </p>

      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <label>Org ID</label>
        <input value={orgId} onChange={e=>setOrgId(e.target.value)} style={{ width: 80 }} />
        <button onClick={loadTools} disabled={!jwt}>Load tools</button>
      </div>

      <hr />

      <h3>Create tool</h3>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <input value={newToolName} onChange={e=>setNewToolName(e.target.value)} placeholder="Tool name" style={{ minWidth: 220 }} />
        <input value={newToolCode} onChange={e=>setNewToolCode(e.target.value)} placeholder="Tool code" style={{ width: 120 }} />
        <input value={defaultLocale} onChange={e=>setDefaultLocale(e.target.value)} placeholder="default locale" style={{ width: 120 }} />
        <input value={enabledLocales} onChange={e=>setEnabledLocales(e.target.value)} placeholder="enabled locales (csv)" style={{ width: 220 }} />
        <button onClick={createTool} disabled={!jwt || !newToolName || !newToolCode}>Create tool</button>
      </div>

      {err && <p style={{ color:'crimson' }}>{err}</p>}

      <h3 style={{ marginTop: 18 }}>Tool list</h3>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        {tools.map(t => (
          <button key={t.id} onClick={()=>loadVersions(t)} style={{ padding:'8px 10px' }}>
            {t.name} <span style={{ color:'#666' }}>({t.code})</span>
          </button>
        ))}
      </div>

      {selectedTool && (
        <div style={{ marginTop: 18 }}>
          <h3>Versions for: {selectedTool.name}</h3>

          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <input value={versionLabel} onChange={e=>setVersionLabel(e.target.value)} placeholder="version label (e.g. 2.0)" style={{ width: 160 }} />
            <button onClick={createDraft} disabled={!jwt || !versionLabel}>Create draft</button>
          </div>

          <pre style={{ background:'#f6f6f6', padding:12, borderRadius:8, overflowX:'auto', marginTop: 12 }}>
            {JSON.stringify(versions, null, 2)}
          </pre>

          <h4>Publish drafts</h4>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {versions.filter(v => v.status === 'draft').map(v => (
              <button key={v.id} onClick={()=>publish(v)}>
                Publish {v.versionLabel} (id {v.id})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


function Users({ jwt }: { jwt: string }) {
  const [orgId, setOrgId] = useState('1');
  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [roleUserId, setRoleUserId] = useState('');
  const [roleCode, setRoleCode] = useState('ORGADMIN');
  const [toolId, setToolId] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      const data = await apiGet(`/orgs/${orgId}/users`, jwt);
      setUsers(data);
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const invite = async () => {
    setErr('');
    try {
      await apiPost(`/orgs/${orgId}/users/invite`, jwt, { email, fullName: fullName || undefined });
      setEmail(''); setFullName('');
      await load();
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const assign = async () => {
    setErr('');
    try {
      await apiPost(`/orgs/${orgId}/users/${roleUserId}/roles`, jwt, { roleCode, toolId: toolId || undefined });
      await load();
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  return (
    <div>
      <h2>Users (Invite + Roles)</h2>
      <p style={{ color:'#555' }}>Requires <code>users.manage</code> permission in this org.</p>

      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <label>Org ID</label>
        <input value={orgId} onChange={e=>setOrgId(e.target.value)} style={{ width: 80 }} />
        <button onClick={load} disabled={!jwt}>Load Users</button>
      </div>

      <hr />

      <h3>Invite user (email allowlist)</h3>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email" style={{ minWidth: 260 }} />
        <input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="full name (optional)" style={{ minWidth: 220 }} />
        <button onClick={invite} disabled={!jwt || !email}>Invite</button>
      </div>

      <h3 style={{ marginTop: 18 }}>Assign role</h3>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <input value={roleUserId} onChange={e=>setRoleUserId(e.target.value)} placeholder="userId" style={{ width: 120 }} />
        <input value={roleCode} onChange={e=>setRoleCode(e.target.value)} placeholder="roleCode (e.g. ORGADMIN)" style={{ width: 220 }} />
        <input value={toolId} onChange={e=>setToolId(e.target.value)} placeholder="toolId (optional)" style={{ width: 160 }} />
        <button onClick={assign} disabled={!jwt || !roleUserId || !roleCode}>Assign</button>
      </div>

      {err && <p style={{ color:'crimson' }}>{err}</p>}

      <h3 style={{ marginTop: 18 }}>Org members</h3>
      <pre style={{ background:'#f6f6f6', padding:12, borderRadius:8, overflowX:'auto' }}>{JSON.stringify(users, null, 2)}</pre>
    </div>
  );
}


function Builder({ jwt, uiLocale }: { jwt: string; uiLocale: string }) {
  const [orgId, setOrgId] = useState('1');
  const [toolId, setToolId] = useState('');
  const [versionId, setVersionId] = useState('');

  const [forms, setForms] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [translations, setTranslations] = useState<any[]>([]);
  const [calculatedFields, setCalculatedFields] = useState<any[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);
  const [err, setErr] = useState('');

  const [formName, setFormName] = useState('SPARS Assessment');
  const [formCode, setFormCode] = useState('SPARS_MAIN');

  const [sectionFormId, setSectionFormId] = useState('');
  const [sectionCode, setSectionCode] = useState('DISPENSING_QUALITY');
  const [sectionSort, setSectionSort] = useState('10');

  const [questionSectionId, setQuestionSectionId] = useState('');
  const [questionCode, setQuestionCode] = useState('DQ_01');
  const [questionType, setQuestionType] = useState('boolean');
  const [questionSort, setQuestionSort] = useState('10');
  const [allowNa, setAllowNa] = useState(true);
  const [naReason, setNaReason] = useState(true);
  const [requiredDefault, setRequiredDefault] = useState(false);
  const [constraintsJson, setConstraintsJson] = useState('{}');
  const [scoringJson, setScoringJson] = useState('{"weight":1,"map":{"true":1,"false":0}}');

  const [optionQuestionId, setOptionQuestionId] = useState('');
  const [optionValue, setOptionValue] = useState('Yes');
  const [optionSort, setOptionSort] = useState('0');

  const [ruleName, setRuleName] = useState('Cold chain applicability');
  const [triggerExprJson, setTriggerExprJson] = useState('{"op":"eq","left":{"q":"HAS_REFRIGERATOR"},"right":false}');
  const [actionsJson, setActionsJson] = useState('[{"action":"setNA","target":{"sectionCode":"COLD_CHAIN"},"value":true}]');

  const [cfCode, setCfCode] = useState('MODULE_DISPENSING_SCORE');
  const [cfOutputType, setCfOutputType] = useState('percent');
  const [cfFormulaJson, setCfFormulaJson] = useState('{"op":"percentFromQuestions","questionCodes":["DQ_01"]}');

  const [indicatorCode, setIndicatorCode] = useState('MODULE_DISPENSING');
  const [indicatorType, setIndicatorType] = useState('module');
  const [indicatorDefJson, setIndicatorDefJson] = useState('{"valueFrom":"MODULE_DISPENSING_SCORE"}');

  const [trEntityType, setTrEntityType] = useState('question');
  const [trEntityId, setTrEntityId] = useState('');
  const [trLocale, setTrLocale] = useState('fr');
  const [trField, setTrField] = useState('label');
  const [trValue, setTrValue] = useState('');

  const loadForms = async () => {
    try {
      const data = await apiGet(`/orgs/${orgId}/tools/${toolId}/versions/${versionId}/forms`, jwt);
      setForms(data);
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const loadRules = async () => {
    try {
      const data = await apiGet(`/orgs/${orgId}/tools/${toolId}/versions/${versionId}/rules`, jwt);
      setRules(data);
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const loadCalculatedFields = async () => {
    try {
      const data = await apiGet(`/orgs/${orgId}/tools/${toolId}/versions/${versionId}/calculated-fields`, jwt);
      setCalculatedFields(data);
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const loadIndicators = async () => {
    try {
      const data = await apiGet(`/orgs/${orgId}/tools/${toolId}/versions/${versionId}/indicators`, jwt);
      setIndicators(data);
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const loadTranslations = async () => {
    try {
      const data = await apiGet(`/orgs/${orgId}/translations?locale=${encodeURIComponent(trLocale)}`, jwt);
      setTranslations(data);
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const loadAll = async () => {
    setErr('');
    await loadForms();
    await loadRules();
    await loadCalculatedFields();
    await loadIndicators();
    await loadTranslations();
  };

  const preview = async () => {
    setErr('');
    try {
      const data = await apiGet(`/orgs/${orgId}/tools/${toolId}/versions/${versionId}/preview`, jwt);
      console.log('Preview (tool definition JSON):', data);
      alert('Preview loaded. Open browser console to view JSON.');
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const createForm = async () => {
    try {
      await apiPost(`/orgs/${orgId}/tools/${toolId}/versions/${versionId}/forms`, jwt, { name: formName, code: formCode });
      await loadForms();
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const createSection = async () => {
    try {
      await apiPost(`/orgs/${orgId}/forms/${sectionFormId}/sections`, jwt, { code: sectionCode, sortOrder: parseInt(sectionSort, 10) || 0 });
      await loadForms();
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const createQuestion = async () => {
    try {
      await apiPost(`/orgs/${orgId}/sections/${questionSectionId}/questions`, jwt, {
        code: questionCode,
        questionType,
        sortOrder: parseInt(questionSort, 10) || 0,
        allowNa,
        naRequiresReason: naReason,
        isRequiredDefault: requiredDefault,
        constraintsJson: JSON.parse(constraintsJson || '{}'),
        scoringJson: JSON.parse(scoringJson || '{}'),
      });
      await loadForms();
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const createOption = async () => {
    try {
      await apiPost(`/orgs/${orgId}/questions/${optionQuestionId}/options`, jwt, {
        value: optionValue,
        sortOrder: parseInt(optionSort, 10) || 0,
      });
      await loadForms();
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const createRule = async () => {
    try {
      await apiPost(`/orgs/${orgId}/tools/${toolId}/versions/${versionId}/rules`, jwt, {
        name: ruleName,
        triggerExprJson: JSON.parse(triggerExprJson || '{}'),
        actionsJson: JSON.parse(actionsJson || '[]'),
      });
      await loadRules();
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const createCalculatedField = async () => {
    try {
      await apiPost(`/orgs/${orgId}/tools/${toolId}/versions/${versionId}/calculated-fields`, jwt, {
        code: cfCode,
        outputType: cfOutputType,
        formulaJson: JSON.parse(cfFormulaJson || '{}'),
      });
      await loadCalculatedFields();
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const createIndicator = async () => {
    try {
      await apiPost(`/orgs/${orgId}/tools/${toolId}/versions/${versionId}/indicators`, jwt, {
        code: indicatorCode,
        indicatorType,
        definitionJson: JSON.parse(indicatorDefJson || '{}'),
      });
      await loadIndicators();
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  const saveTranslation = async () => {
    try {
      await apiPost(`/orgs/${orgId}/translations`, jwt, {
        entityType: trEntityType,
        entityId: trEntityId,
        locale: trLocale,
        field: trField,
        value: trValue,
      });
      await loadTranslations();
    } catch (e: any) { setErr(e.message || String(e)); }
  };

  return (
    <div>
      <h2>Builder (Step 5)</h2>
      <p style={{ color:'#555' }}>
        Draft builder with <b>rules</b>, <b>calculated fields</b>, <b>indicators</b>, and initial <b>i18n</b> translation management.
      </p>
      <p style={{ color:'#666' }}>Current admin UI locale: <b>{uiLocale}</b></p>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <label>Org</label><input value={orgId} onChange={e=>setOrgId(e.target.value)} style={{ width: 80 }} />
        <label>Tool ID</label><input value={toolId} onChange={e=>setToolId(e.target.value)} style={{ width: 120 }} />
        <label>Version ID</label><input value={versionId} onChange={e=>setVersionId(e.target.value)} style={{ width: 140 }} />
        <button onClick={loadAll} disabled={!jwt || !toolId || !versionId}>Load all</button>
        <button onClick={preview} disabled={!jwt || !toolId || !versionId}>Preview</button>
      </div>

      {err && <p style={{ color:'crimson' }}>{err}</p>}

      <hr />
      <h3>Create Form</h3>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <input value={formName} onChange={e=>setFormName(e.target.value)} placeholder="Form name" style={{ minWidth: 220 }} />
        <input value={formCode} onChange={e=>setFormCode(e.target.value)} placeholder="Form code" style={{ width: 160 }} />
        <button onClick={createForm} disabled={!jwt || !toolId || !versionId}>Create Form</button>
      </div>

      <h3 style={{ marginTop: 16 }}>Create Section</h3>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <input value={sectionFormId} onChange={e=>setSectionFormId(e.target.value)} placeholder="formId" style={{ width: 120 }} />
        <input value={sectionCode} onChange={e=>setSectionCode(e.target.value)} placeholder="section code" style={{ width: 220 }} />
        <input value={sectionSort} onChange={e=>setSectionSort(e.target.value)} placeholder="sort" style={{ width: 80 }} />
        <button onClick={createSection} disabled={!jwt || !sectionFormId}>Create Section</button>
      </div>

      <h3 style={{ marginTop: 16 }}>Create Question</h3>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <input value={questionSectionId} onChange={e=>setQuestionSectionId(e.target.value)} placeholder="sectionId" style={{ width: 120 }} />
        <input value={questionCode} onChange={e=>setQuestionCode(e.target.value)} placeholder="question code" style={{ width: 160 }} />
        <input value={questionType} onChange={e=>setQuestionType(e.target.value)} placeholder="type (boolean, number...)" style={{ width: 220 }} />
        <input value={questionSort} onChange={e=>setQuestionSort(e.target.value)} placeholder="sort" style={{ width: 80 }} />
        <label><input type="checkbox" checked={allowNa} onChange={e=>setAllowNa(e.target.checked)} /> allow NA</label>
        <label><input type="checkbox" checked={naReason} onChange={e=>setNaReason(e.target.checked)} /> NA reason</label>
        <label><input type="checkbox" checked={requiredDefault} onChange={e=>setRequiredDefault(e.target.checked)} /> required</label>
      </div>
      <div style={{ marginTop: 8 }}>
        <label>constraintsJson</label>
        <textarea rows={3} value={constraintsJson} onChange={e=>setConstraintsJson(e.target.value)} style={{ width:'100%' }} />
      </div>
      <div style={{ marginTop: 8 }}>
        <label>scoringJson</label>
        <textarea rows={3} value={scoringJson} onChange={e=>setScoringJson(e.target.value)} style={{ width:'100%' }} />
      </div>
      <button onClick={createQuestion} disabled={!jwt || !questionSectionId || !questionCode} style={{ marginTop: 8 }}>Create Question</button>

      <h3 style={{ marginTop: 16 }}>Create Option</h3>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <input value={optionQuestionId} onChange={e=>setOptionQuestionId(e.target.value)} placeholder="questionId" style={{ width: 120 }} />
        <input value={optionValue} onChange={e=>setOptionValue(e.target.value)} placeholder="value" style={{ width: 200 }} />
        <input value={optionSort} onChange={e=>setOptionSort(e.target.value)} placeholder="sort" style={{ width: 80 }} />
        <button onClick={createOption} disabled={!jwt || !optionQuestionId || !optionValue}>Create Option</button>
      </div>

      <hr />
      <h3>Create Logic Rule</h3>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <input value={ruleName} onChange={e=>setRuleName(e.target.value)} placeholder="rule name" style={{ minWidth: 240 }} />
      </div>
      <div style={{ marginTop: 8 }}>
        <label>triggerExprJson</label>
        <textarea rows={4} value={triggerExprJson} onChange={e=>setTriggerExprJson(e.target.value)} style={{ width:'100%' }} />
      </div>
      <div style={{ marginTop: 8 }}>
        <label>actionsJson</label>
        <textarea rows={4} value={actionsJson} onChange={e=>setActionsJson(e.target.value)} style={{ width:'100%' }} />
      </div>
      <button onClick={createRule} disabled={!jwt || !toolId || !versionId} style={{ marginTop: 8 }}>Create Rule</button>

      <hr />
      <h3>Create Calculated Field</h3>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <input value={cfCode} onChange={e=>setCfCode(e.target.value)} placeholder="code" style={{ width: 240 }} />
        <input value={cfOutputType} onChange={e=>setCfOutputType(e.target.value)} placeholder="outputType" style={{ width: 120 }} />
      </div>
      <div style={{ marginTop: 8 }}>
        <label>formulaJson</label>
        <textarea rows={4} value={cfFormulaJson} onChange={e=>setCfFormulaJson(e.target.value)} style={{ width:'100%' }} />
      </div>
      <button onClick={createCalculatedField} disabled={!jwt || !toolId || !versionId} style={{ marginTop: 8 }}>Create Calculated Field</button>

      <hr />
      <h3>Create Indicator</h3>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <input value={indicatorCode} onChange={e=>setIndicatorCode(e.target.value)} placeholder="code" style={{ width: 240 }} />
        <input value={indicatorType} onChange={e=>setIndicatorType(e.target.value)} placeholder="indicatorType" style={{ width: 140 }} />
      </div>
      <div style={{ marginTop: 8 }}>
        <label>definitionJson</label>
        <textarea rows={4} value={indicatorDefJson} onChange={e=>setIndicatorDefJson(e.target.value)} style={{ width:'100%' }} />
      </div>
      <button onClick={createIndicator} disabled={!jwt || !toolId || !versionId} style={{ marginTop: 8 }}>Create Indicator</button>

      <hr />
      <h3>Translations (initial i18n)</h3>
      <p style={{ color:'#666' }}>Use this to store localized labels/help strings in the <code>translations</code> table.</p>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <input value={trEntityType} onChange={e=>setTrEntityType(e.target.value)} placeholder="entityType (question, section...)" style={{ width: 220 }} />
        <input value={trEntityId} onChange={e=>setTrEntityId(e.target.value)} placeholder="entityId" style={{ width: 120 }} />
        <input value={trLocale} onChange={e=>setTrLocale(e.target.value)} placeholder="locale" style={{ width: 80 }} />
        <input value={trField} onChange={e=>setTrField(e.target.value)} placeholder="field (label, helpText...)" style={{ width: 180 }} />
      </div>
      <div style={{ marginTop: 8 }}>
        <textarea rows={3} value={trValue} onChange={e=>setTrValue(e.target.value)} placeholder="translated value" style={{ width:'100%' }} />
      </div>
      <button onClick={saveTranslation} disabled={!jwt || !trEntityId || !trValue} style={{ marginTop: 8 }}>Save Translation</button>

      <hr />
      <h3>Current forms</h3>
      <pre style={{ background:'#f6f6f6', padding:12, borderRadius:8, overflowX:'auto' }}>{JSON.stringify(forms, null, 2)}</pre>

      <h3 style={{ marginTop: 16 }}>Current rules</h3>
      <pre style={{ background:'#f6f6f6', padding:12, borderRadius:8, overflowX:'auto' }}>{JSON.stringify(rules, null, 2)}</pre>

      <h3 style={{ marginTop: 16 }}>Current calculated fields</h3>
      <pre style={{ background:'#f6f6f6', padding:12, borderRadius:8, overflowX:'auto' }}>{JSON.stringify(calculatedFields, null, 2)}</pre>

      <h3 style={{ marginTop: 16 }}>Current indicators</h3>
      <pre style={{ background:'#f6f6f6', padding:12, borderRadius:8, overflowX:'auto' }}>{JSON.stringify(indicators, null, 2)}</pre>

      <h3 style={{ marginTop: 16 }}>Current translations</h3>
      <pre style={{ background:'#f6f6f6', padding:12, borderRadius:8, overflowX:'auto' }}>{JSON.stringify(translations, null, 2)}</pre>
    </div>
  );
}
