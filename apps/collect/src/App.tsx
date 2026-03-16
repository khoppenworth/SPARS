import React, { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { getKv, setKv } from './db';

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
  const data = await resp.json().catch(()=>({}));
  if (!resp.ok) throw new Error(data?.message || `HTTP ${resp.status}`);
  return data;
}

export default function App() {
  const [jwt, setJwt] = useState('');
  useEffect(()=>{ getKv<string>('jwt').then(v=>v && setJwt(v)); }, []);
  const saveJwt = async (v: string) => { setJwt(v); await setKv('jwt', v); };

  return (
    <div style={{ fontFamily:'system-ui', padding:16, maxWidth:900, margin:'0 auto' }}>
      <h1>SPARS Collector (PWA)</h1>
      <nav style={{ display:'flex', gap:12, marginBottom:16 }}>
        <Link to='/'>Home</Link>
        <Link to='/package'>Fetch Tool Package</Link>
      </nav>
      <Routes>
        <Route path='/' element={<Home jwt={jwt} saveJwt={saveJwt} />} />
        <Route path='/package' element={<Package jwt={jwt} />} />
      </Routes>
    </div>
  );
}

function Home({ jwt, saveJwt }: any) {
  const [v, setV] = useState(jwt);
  return (
    <div>
      <h2>JWT</h2>
      <p>Temporary scaffold: paste JWT here.</p>
      <textarea rows={5} value={v} onChange={e=>setV(e.target.value)} style={{ width:'100%' }} />
      <button onClick={()=>saveJwt(v.trim())} style={{ marginTop:8 }}>Save</button>
      <p style={{ color:'#666' }}>Next: implement Google Sign-In button and exchange ID token at <code>/auth/google</code>.</p>
    </div>
  );
}

function Package({ jwt }: { jwt: string }) {
  const [versionId, setVersionId] = useState('');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');

  const load = async () => {
    setErr('');
    try { setData(await api(`/collector/tool-versions/${versionId}/package`, jwt)); }
    catch(e:any){ setErr(e.message||String(e)); }
  };

  return (
    <div>
      <h2>Tool Package</h2>
      <div style={{ display:'flex', gap:8 }}>
        <input value={versionId} onChange={e=>setVersionId(e.target.value)} placeholder='Published toolVersionId' />
        <button onClick={load} disabled={!jwt || !versionId}>Fetch</button>
      </div>
      {!jwt && <p style={{ color:'#999' }}>Set JWT first.</p>}
      {err && <p style={{ color:'crimson' }}>{err}</p>}
      {data?.forms?.length ? <Questionnaire packageData={data} /> : null}
      <pre style={{ background:'#f6f6f6', padding:12, borderRadius:8, overflowX:'auto' }}>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

function Questionnaire({ packageData }: { packageData: any }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [missingKeys, setMissingKeys] = useState<string[]>([]);
  const [submitState, setSubmitState] = useState<'idle'|'valid'|'invalid'>('idle');

  const questions = (packageData?.forms || [])
    .flatMap((form: any) => (form.sections || []).flatMap((section: any) =>
      (section.questions || []).map((question: any) => ({
        formCode: form.code,
        sectionCode: section.code,
        ...question,
      })),
    ));

  const keyOf = (question: any) => `${question.formCode}::${question.sectionCode}::${question.code}`;

  const setAnswer = (question: any, value: string) => {
    const questionKey = keyOf(question);
    setAnswers(prev => ({ ...prev, [questionKey]: value }));
    setMissingKeys(prev => prev.filter(k => k !== questionKey));
  };

  const isBlank = (question: any) => {
    const value = answers[keyOf(question)];
    return !value || value.trim() === '';
  };

  const submit = () => {
    const missingRequired = questions.filter((question: any) => question.requiredDefault && isBlank(question));

    if (missingRequired.length) {
      const keys = missingRequired.map((question: any) => keyOf(question));
      setMissingKeys(keys);
      setSubmitState('invalid');

      const firstMissing = document.getElementById(keys[0]);
      if (firstMissing) {
        firstMissing.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstMissing.focus();
      }
      return;
    }

    setSubmitState('valid');
    setMissingKeys([]);
  };

  return (
    <section style={{ marginTop: 16, marginBottom: 20, border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>Questionnaire</h3>
      <p style={{ marginTop: 0, color: '#555' }}>Required questions are marked with <strong>*</strong>.</p>

      <div style={{ display: 'grid', gap: 12 }}>
        {questions.map((question: any) => {
          const questionKey = keyOf(question);
          const missing = missingKeys.includes(questionKey);

          return (
            <div
              key={questionKey}
              style={{
                border: `1px solid ${missing ? '#d93025' : '#d7d7d7'}`,
                borderRadius: 8,
                padding: 12,
                background: missing ? '#fff2f0' : '#fff',
              }}
            >
              <label htmlFor={questionKey} style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                {question.code} {question.requiredDefault ? '*' : ''}
              </label>
              <QuestionInput
                id={questionKey}
                question={question}
                value={answers[questionKey] || ''}
                onChange={(value) => setAnswer(question, value)}
              />
              {missing ? <div style={{ color: '#d93025', marginTop: 6, fontSize: 13 }}>This field is required.</div> : null}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={submit}>Submit questionnaire</button>
        {submitState === 'valid' ? <span style={{ color: '#137333' }}>All required fields are completed.</span> : null}
        {submitState === 'invalid' ? <span style={{ color: '#d93025' }}>Please complete all highlighted required fields.</span> : null}
      </div>
    </section>
  );
}

function QuestionInput({ id, question, value, onChange }: { id: string; question: any; value: string; onChange: (value: string) => void }) {
  if (Array.isArray(question.options) && question.options.length) {
    return (
      <select id={id} value={value} onChange={e=>onChange(e.target.value)} style={{ width: '100%', padding: 8 }}>
        <option value=''>Select an option</option>
        {question.options
          .slice()
          .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
          .map((option: any) => (
            <option key={option.value} value={option.value}>{option.value}</option>
          ))}
      </select>
    );
  }

  if (question.type === 'number') {
    return <input id={id} type='number' value={value} onChange={e=>onChange(e.target.value)} style={{ width: '100%', padding: 8 }} />;
  }

  return <input id={id} type='text' value={value} onChange={e=>onChange(e.target.value)} style={{ width: '100%', padding: 8 }} />;
}
