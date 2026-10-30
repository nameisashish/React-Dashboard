import { useEffect, useState } from 'react';
import { authService } from '../services/authService.js';
import { Button, Card, LoadingPage } from '../components/ui.jsx';

const roleLabel = role => role === 'Viewer' ? 'User' : role || '—';
const shownDate = value => value ? new Date(value).toLocaleString() : '—';

export function UsersPage() {
  const [users, setUsers] = useState([]);
  const [assigned, setAssigned] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setError('');
    try { setUsers(await authService.requests()); } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);
  async function decide(id, decision) {
    setBusy(true); setError('');
    try { await authService.decide(id, decision, assigned[id] || 'Viewer'); await load(); }
    catch (e) { setError(e.message); setBusy(false); }
  }
  const pending = users.filter(user => user.status === 'Pending Approval').length;
  return <><h1 className="page-title">User Management</h1><Card className="records-card user-table-card">
    <div className="table-toolbar"><div><p>Account and approval fields from dbo.Users. Password hashes are excluded.</p><span>{users.length.toLocaleString()} accounts · {pending.toLocaleString()} pending approval</span></div><Button disabled={busy} variant="secondary" onClick={load}>Refresh</Button></div>
    {error && <p role="alert" className="alert error">{error}</p>}
    {busy && <p role="status">Loading or updating accounts…</p>}
    {busy && !users.length ? <LoadingPage/> : <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Requested role</th><th>Assigned role</th><th>Approval</th><th>Access</th><th>Created</th><th>Updated</th><th>Reviewed by</th><th>Reviewed at</th><th>Review note</th><th>Actions</th></tr></thead><tbody>
    {users.map(user => <tr key={user.id}>
      <td>{user.fullName}</td><td>{user.email}</td><td>{roleLabel(user.requestedRole)}</td>
      <td>{user.status === 'Pending Approval' ? <select aria-label={`Assign role for ${user.email}`} value={assigned[user.id] || 'Viewer'} disabled={busy} onChange={e => setAssigned({ ...assigned, [user.id]: e.target.value })}><option value="Viewer">User</option><option>Super User</option></select> : roleLabel(user.assignedRole)}</td>
      <td>{user.status}</td><td>{user.isActive === undefined ? '—' : user.isActive ? 'Active' : 'Inactive'}</td>
      <td>{shownDate(user.registeredAt)}</td><td>{shownDate(user.updatedAt)}</td><td>{user.reviewedBy || '—'}</td><td>{shownDate(user.reviewedAt)}</td>
      <td className="user-review-note">{user.reviewComment || '—'}</td>
      <td>{user.status === 'Pending Approval' && <div className="row-actions"><Button disabled={busy} onClick={() => decide(user.id, 'approve')}>Approve</Button><Button disabled={busy} variant="danger" onClick={() => decide(user.id, 'reject')}>Reject</Button></div>}</td>
    </tr>)}
    </tbody></table></div>}
    {!users.length && !busy && !error && <p>No user records.</p>}
  </Card></>;
}
