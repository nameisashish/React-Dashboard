import { BarChart3, FileSpreadsheet, LogOut, Menu, ShieldCheck, X, } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Modal } from "./ui.jsx";
import { authService } from "../services/authService.js";
export function Layout({ children, page, user, onNavigate, onLogout, }) {
    const [error, setError] = useState("");
    const safe = async action => { try { setError(""); await action(); } catch (e) { setError("Unable to update user access: " + e.message); } };
    const [menu, setMenu] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [requests, setRequests] = useState([]);
    const [usersOpen, setUsersOpen] = useState(false);
    const [filter, setFilter] = useState("Pending Approval");
    const [target, setTarget] = useState(null);
    const [assigned, setAssigned] = useState("Viewer");
    const profileRef = useRef(null);
    const initials = user.fullName
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    useEffect(() => {
        if (!profileOpen)
            return;
        const closeOutside = (event) => {
            if (!profileRef.current?.contains(event.target))
                setProfileOpen(false);
        };
        const closeEscape = (event) => {
            if (event.key === "Escape")
                setProfileOpen(false);
        };
        document.addEventListener("mousedown", closeOutside);
        document.addEventListener("keydown", closeEscape);
        return () => {
            document.removeEventListener("mousedown", closeOutside);
            document.removeEventListener("keydown", closeEscape);
        };
    }, [profileOpen]);
    useEffect(() => {
        if (profileOpen && user.role === "Admin")
            authService.requests().then(setRequests).catch(e => setError(e.message));
    }, [profileOpen, user.role]);
    const accessLevel = user.role === "Admin" ? "Full administrative access." : user.role === "Super User" ? "Can view and export fine records and change fine statuses. Cannot manage users." : "Read-only access to fine records and permitted exports.";
    return (<div className="app-shell">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark">M</div>
          <div>
            <strong>MARS</strong>
            <span>Fines &amp; Fees</span>
          </div>
          <button className="mobile-close" onClick={() => setMenu(false)} aria-label="Close navigation">
            <X size={20}/>
          </button>
        </div>
        <nav aria-label="Primary navigation">
          <button className={page === "dashboard" ? "active" : ""} onClick={() => {
            onNavigate("dashboard");
            setMenu(false);
        }}>
            <BarChart3 size={19}/>
            <span>Executive Summary</span>
          </button>
          <button className={page === "fines" ? "active" : ""} onClick={() => {
            onNavigate("fines");
            setMenu(false);
        }}>
            <FileSpreadsheet size={19}/>
            <span>Fines Details</span>
          </button>
        </nav>
        <div className="sidebar-bottom" ref={profileRef}>
          {profileOpen && (<section className="profile-popover" role="dialog" aria-label="User profile">
              <div className="profile-popover-head">
                <div className="avatar large">{initials}</div>
                <div>
                  <strong>{user.fullName}</strong>
                  <span>{user.email}</span>
                  <b className={`role-badge role-${user.role.toLowerCase().replace(/\s+/g, "-")}`}>
                    {user.role === "Viewer" ? "User" : user.role}
                  </b>
                </div>
              </div>
              <div className="account-details">
                <h2>Account details</h2>
                <dl>
                  <div>
                    <dt>Full Name</dt>
                    <dd>{user.fullName}</dd>
                  </div>
                  <div>
                    <dt>Email Address</dt>
                    <dd>{user.email}</dd>
                  </div>
                  <div>
                    <dt>Assigned Role</dt>
                    <dd>{user.role === "Viewer" ? "User" : user.role}</dd>
                  </div>
                  <div>
                    <dt>Access Level</dt>
                    <dd>{accessLevel}</dd>
                  </div>
                </dl>
              </div>
              {user.role === "Admin" && <Button variant="secondary" className="profile-signout" onClick={() => safe(async () => { setRequests(await authService.requests()); setUsersOpen(true); setProfileOpen(false); })}>User Management {requests.filter(r => r.status === "Pending Approval").length > 0 && <b>· Pending Approvals {requests.filter(r => r.status === "Pending Approval").length}</b>}</Button>}
              <Button variant="secondary" className="profile-signout" onClick={onLogout}>
                <LogOut size={16}/>
                Sign out
              </Button>
            </section>)}
          <button className="profile" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} aria-haspopup="dialog">
            <div className="avatar">{initials}</div>
            <div>
              <strong>{user.fullName}</strong>
              <span>{user.role === "Viewer" ? "User" : user.role}</span>
            </div>
            <ShieldCheck size={17}/>
          </button>
        </div>
      </aside>
      {menu && (<button className="nav-scrim" onClick={() => setMenu(false)} aria-label="Close navigation"/>)}
      <main className="main">
        {error && <p role="alert" className="alert error">{error}</p>}
        <button className="menu-btn" onClick={() => setMenu(true)} aria-label="Open navigation">
          <Menu size={21}/>
        </button>
        <div className="content">{children}</div>
      </main>
      {usersOpen && <Modal title="User Management" onClose={() => setUsersOpen(false)} className="users-modal"><div className="modal-body"><p>Review registrations and manage user access.</p><div className="user-tabs">{["Pending Approval", "Approved", "Rejected"].map(s => <Button key={s} variant={filter === s ? "primary" : "secondary"} onClick={() => setFilter(s)}>{s}{s === "Pending Approval" ? ` (${requests.filter(r => r.status === s).length})` : ""}</Button>)}</div><div className="table-wrap"><table><thead><tr><th>User ID</th><th>Full Name</th><th>Email</th><th>Requested</th><th>Assigned</th><th>Registered</th><th>Status</th><th>Actions</th></tr></thead><tbody>{requests.filter(r => r.status === filter).map(r => <tr key={r.id}><td>{r.id}</td><td>{r.fullName}</td><td>{r.email}</td><td>{r.requestedRole === "Viewer" ? "User" : r.requestedRole}</td><td>{r.assignedRole === "Viewer" ? "User" : r.assignedRole ?? "Not assigned"}</td><td>{new Date(r.registeredAt).toLocaleDateString()}</td><td>{r.status}</td><td>{r.status === "Pending Approval" && <><Button variant="secondary" onClick={() => setTarget(r)}>Approve</Button> <Button variant="danger" onClick={() => safe(async () => { await authService.decide(r.id, "reject"); setRequests(await authService.requests()); })}>Reject</Button></>}</td></tr>)}</tbody></table></div>{requests.filter(r => r.status === filter).length === 0 && <p>{filter === "Pending Approval" ? "No pending registrations" : "All registration requests have been reviewed."}</p>}</div></Modal>}
      {target && <Modal title="Approve User" onClose={() => setTarget(null)}><div className="modal-body"><p>Approve {target.fullName} ({target.email})?</p><label className="form-field"><span>Assign Role</span><select value={assigned} onChange={e => setAssigned(e.target.value)}><option>Super User</option><option value="Viewer">User</option></select></label><p>{assigned === "Super User" ? "Can view fine records and change eligible fine statuses. Cannot manage users." : "Can view fine records and export permitted records. Cannot change fine statuses or manage users."}</p><div className="modal-actions"><Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button><Button onClick={() => safe(async () => { await authService.decide(target.id, "approve", assigned); setRequests(await authService.requests()); setTarget(null); })}>Confirm Approval</Button></div></div></Modal>}
    </div>);
}
