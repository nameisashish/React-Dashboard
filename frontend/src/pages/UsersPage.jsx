import { useEffect, useState } from 'react';
import { authService } from '../services/authService.js';
import { Button, Card } from '../components/ui.jsx';
export function UsersPage() {
  const [requests, setRequests] = useState([]);
  const [assigned, setAssigned] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setError('');
    try { setRequests(await authService.requests()); } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);
  async function decide(id, decision) {
    setBusy(true); setError('');
    try {
      await authService.decide(id, decision, assigned[id] || 'Viewer');
      setRequests(await authService.requests());
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const roleLabel = role => role === 'Viewer' ? 'User' : role;
  return <><h1 className="page-title">User Management</h1><Card className="records-card">
    <div className="table-toolbar"><p>Approve registrations and assign access. Only administrators can manage accounts.</p><Button disabled={busy} variant="secondary" onClick={load}>Refresh</Button></div>
    {error && <p role="alert" className="alert error">{error}</p>}
    {busy && <p role="status">Updating accounts…</p>}
    <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Requested role</th><th>Assigned role</th><th>Status</th><th>Actions</th></tr></thead><tbody>
    {requests.map(r => <tr key={r.id}><td>{r.fullName}</td><td>{r.email}</td><td>{roleLabel(r.requestedRole)}</td><td>{r.status === 'Pending Approval' ? <select aria-label={`Assign role for ${r.email}`} value={assigned[r.id] || 'Viewer'} disabled={busy} onChange={e => setAssigned({ ...assigned, [r.id]: e.target.value })}><option value="Viewer">User</option><option>Super User</option></select> : roleLabel(r.assignedRole) || '—'}</td><td>{r.status}</td><td>{r.status === 'Pending Approval' && <div className="row-actions"><Button disabled={busy} onClick={() => decide(r.id, 'approve')}>Approve</Button><Button disabled={busy} variant="danger" onClick={() => decide(r.id, 'reject')}>Reject</Button></div>}</td></tr>)}
    </tbody></table></div>{!requests.length && !busy && !error && <p>No registration requests.</p>}
  </Card></>;
}
