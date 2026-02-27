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
      <pre style={{ background:'#f6f6f6', padding:12, borderRadius:8, overflowX:'auto' }}>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
