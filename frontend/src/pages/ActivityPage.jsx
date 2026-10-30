import { useCallback, useEffect, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { api } from "../services/api.js";
import { Button, Card, EmptyState, LoadingPage, Select } from "../components/ui.jsx";

const PAGE_SIZE = 25;
const eventTypes = ["Validation", "Finance", "Comment", "DataEdit", "UserManagement"];
const eventLabels = { Validation: "Validation", Finance: "Finance", Comment: "Comment", DataEdit: "Fine edit", UserManagement: "User management" };
const dateTime = value => value ? new Date(value).toLocaleString() : "—";

export function ActivityPage() {
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [eventType, setEventType] = useState("");
    const [fineId, setFineId] = useState("");
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true); setError("");
        const params = new URLSearchParams({ offset: String(page * PAGE_SIZE), limit: String(PAGE_SIZE) });
        if (eventType) params.set("eventType", eventType);
        if (fineId.trim()) params.set("fineId", fineId.trim());
        try {
            const result = await api(`/activity-events?${params}`);
            setItems(result.items || []); setTotal(result.total || 0);
        } catch (e) { setError(e.message || "Could not load activity events."); }
        finally { setLoading(false); }
    }, [eventType, fineId, page]);

    useEffect(() => { load(); }, [load]);
    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return <>
      <h1 className="page-title">Activity Log</h1>
      <Card className="records-card activity-card">
        <div className="activity-intro"><Activity size={18}/><p>Audit events from <strong>dbo.ActivityEvents</strong>, joined to user names from <strong>dbo.Users</strong>. Password hashes are never shown.</p></div>
        <div className="activity-filters">
          <Select label="Event type" value={eventType} onChange={e => { setEventType(e.target.value); setPage(0); }}>
            <option value="">All event types</option>{eventTypes.map(type => <option key={type} value={type}>{eventLabels[type]}</option>)}
          </Select>
          <label className="field"><span>Fine ID</span><input inputMode="numeric" value={fineId} onChange={e => { setFineId(e.target.value.replace(/\D/g, "")); setPage(0); }} placeholder="All fine IDs"/></label>
          <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw size={15}/>Refresh</Button>
        </div>
        {error && <p role="alert" className="alert error">{error}</p>}
        <div className="table-toolbar"><span>{loading ? "Loading activity…" : `${total.toLocaleString()} matching events`}</span><span>25 rows per page</span></div>
        {loading ? <LoadingPage/> : !items.length ? <EmptyState title="No activity events" description="Try another event type or fine ID."/> : <div className="table-wrap activity-table">
          <table><thead><tr><th>Created</th><th>Event</th><th>Fine / user</th><th>Actor</th><th>Field</th><th>Change</th><th>Comment</th></tr></thead>
            <tbody>{items.map(event => <tr key={event.eventId}>
              <td>{dateTime(event.createdAt)}</td><td><span className={`event-badge event-${event.eventType.toLowerCase()}`}>{eventLabels[event.eventType] || event.eventType}</span></td>
              <td>{event.fineId ? `Fine ${event.fineId}` : event.targetUserName || (event.targetUserId ? `User ${event.targetUserId}` : "—")}</td>
              <td>{event.actorName}</td><td>{event.fieldName || "—"}</td>
              <td className="event-change">{event.oldValue || event.newValue ? <>{event.oldValue || "—"}<span> → </span>{event.newValue || "—"}</> : "—"}</td>
              <td className="event-comment">{event.comment}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        <div className="pagination"><span>Showing {total ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()} events</span>
          <div><Button variant="secondary" disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}><ChevronLeft size={15}/>Previous</Button><span>Page {page + 1} of {maxPage}</span><Button variant="secondary" disabled={page + 1 >= maxPage || loading} onClick={() => setPage(p => p + 1)}>Next<ChevronRight size={15}/></Button></div>
        </div>
      </Card>
    </>;
}
