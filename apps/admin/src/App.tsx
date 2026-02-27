import React, { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
const API_BASE = (import.meta as any).env.VITE_API_BASE || '/api/v1';

async function apiGet(path: string, jwt: string) {
  const resp = await fetch(`${API_BASE}${path}`, { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} });
  const data = await resp.json().catch(()=>({}));
  if (!resp.ok) throw new Error(data?.message || `HTTP ${resp.status}`);
  return data;
}

export default function App() {
  const [jwt, setJwt] = useState(localStorage.getItem('jwt') || '');
  const [me, setMe] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(()=>{ if(!jwt) return; apiGet('/me', jwt).then(setMe).catch(e=>setErr(String(e.message||e))); }, [jwt]);

  const save = (v: string) => { localStorage.setItem('jwt', v); setJwt(v); };
  const logout = () => { localStorage.removeItem('jwt'); setJwt(''); setMe(null); };

  return (
    <div style={{ fontFamily:'system-ui', padding:24, maxWidth:1000, margin:'0 auto' }}>
      <h1>SPARS Admin</h1>
      <nav style={{ display:'flex', gap:12, marginBottom:16 }}>
        <Link to='/'>Home</Link>
        <Link to='/tools'>Tools</Link>
        <Link to='/users'>Users</Link>
        <a href='/api/docs' target='_blank' rel='noreferrer'>API Docs</a>
      </nav>
      <Routes>
        <Route path='/' element={<Home jwt={jwt} save={save} logout={logout} me={me} err={err} />} />
        <Route path='/tools' element={<Tools jwt={jwt} />} />
        <Route path='/users' element={<Users jwt={jwt} />} />
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
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const load = async () => {
    setErr('');
    try { setData(await apiGet(`/orgs/${orgId}/tools`, jwt)); }
    catch(e:any){ setErr(e.message||String(e)); }
  };
  return (
    <div>
      <h2>Tools</h2>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <label>Org ID</label>
        <input value={orgId} onChange={e=>setOrgId(e.target.value)} />
        <button onClick={load} disabled={!jwt}>Load</button>
      </div>
      {!jwt && <p style={{ color:'#999' }}>Login first.</p>}
      {err && <p style={{ color:'crimson' }}>{err}</p>}
      <pre style={{ background:'#f6f6f6', padding:12, borderRadius:8, overflowX:'auto' }}>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
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
