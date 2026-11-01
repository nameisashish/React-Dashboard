import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, CircleDollarSign, Clock3, FileText, RotateCcw, ShieldCheck, Activity } from "lucide-react";
import { ReasonsChart, FinanceSettlementChart, StatusDistribution, TrendChart, ValidationByAreaChart } from "../components/charts.jsx";
import { Button, Card, EmptyState, LoadingPage, Select } from "../components/ui.jsx";
import { finesService } from "../services/finesService.js";
import { useFines } from "../services/useFines.js";
import { filterFines, money } from "../utils/fines.js";

const emptyFilters = { status: undefined, customerId: undefined, sourceArea: undefined, reasons: [] };
const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const presetRange = preset => {
    if (preset === "all") return { fromDate: undefined, toDate: undefined };
    const to = new Date();
    const from = new Date();
    if (preset === "30") from.setDate(from.getDate() - 30);
    else if (preset === "90") from.setDate(from.getDate() - 90);
    else if (preset === "year") from.setMonth(0, 1);
    else from.setFullYear(from.getFullYear() - 1);
    return { fromDate: localDate(from), toDate: localDate(to) };
};
const selectedPreset = filters => {
    if (!filters.fromDate && !filters.toDate) return "all";
    for (const preset of ["30", "90", "12", "year"]) {
        const range = presetRange(preset);
        if (range.fromDate === filters.fromDate && range.toDate === filters.toDate) return preset;
    }
    return "custom";
};

export function DashboardPage({ records, onNavigateFines, onNavigate, role, filters, onApplyFilters }) {
    const [draftFilters, setDraftFilters] = useState(filters);
    const [datePreset, setDatePreset] = useState(() => selectedPreset(filters));
    const [overview, setOverview] = useState(null);
    const [overviewError, setOverviewError] = useState("");
    const [overviewLoading, setOverviewLoading] = useState(true);
    useEffect(() => {
        setDraftFilters(filters);
        setDatePreset(selectedPreset(filters));
    }, [filters]);
    const resetFilters = () => { setDraftFilters(emptyFilters); setDatePreset("all"); };
    const clearAndApply = () => { resetFilters(); onApplyFilters(emptyFilters); };
    const remote = useFines(filters, records);
    const filtered = useMemo(() => filterFines(remote.rows, filters), [remote.rows, filters]);
    const filtersChanged = JSON.stringify(draftFilters) !== JSON.stringify(filters);

    useEffect(() => {
        let active = true;
        if (role === "Viewer") {
            setOverviewLoading(false);
            return () => { active = false; };
        }
        setOverviewLoading(true); setOverviewError("");
        finesService.summary().then(data => { if (active) setOverview(data); })
            .catch(error => { if (active) setOverviewError(error.message || "Overview unavailable."); })
            .finally(() => { if (active) setOverviewLoading(false); });
        return () => { active = false; };
    }, [role]);

    const pending = filtered.filter(f => f.status === "Pending");
    const totalFineAmount = filtered.reduce((sum, f) => sum + Number(f.fineAmount || 0), 0);
    const pendingAmount = pending.reduce((sum, f) => sum + Number(f.fineAmount || 0), 0);
    const invoiceAmount = filtered.reduce((sum, f) => sum + Number(f.invoiceAmount ?? f.fineAmount ?? 0), 0);
    const amountReceived = filtered.reduce((sum, f) => sum + Number(f.amountReceived || 0), 0);
    const outstanding = filtered.reduce((sum, f) => sum + Math.max(0, Number(f.invoiceAmount ?? f.fineAmount ?? 0) - Number(f.amountReceived || 0)), 0);
    const collectionRate = invoiceAmount ? amountReceived / invoiceAmount : 0;
    const unclassified = filtered.filter(f => !f.sourceArea || f.sourceArea === "Unknown").length;
    const missingActualDelivery = filtered.filter(f => !f.actualDeliveryDate).length;
    const missingDeliveredQuantity = filtered.filter(f => f.deliveredQuantity == null).length;
    const reasons = [...new Set(records.map(f => f.reasonCategory).filter(Boolean))].sort();
    const customers = Array.from(new Map(records.map(f => [f.customerId, f.customerName])));
    const sourceOrder = ["Logistics", "Warehouse", "Manufacturing", "Unknown"];
    const sources = [...new Set(records.map(f => f.sourceArea || "Unknown"))].sort((a, b) => {
        const ai = sourceOrder.indexOf(a), bi = sourceOrder.indexOf(b);
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.localeCompare(b);
    });

    const updatePreset = preset => setDraftFilters(f => ({ ...f, ...presetRange(preset) }));

    return <>
      {remote.error && <p role="alert" className="alert error">Unable to load records: {remote.error}. <Button onClick={remote.retry}>Retry</Button></p>}
      <Card className="filter-bar sticky-filters">
        <Select label="Fine date" value={datePreset} onChange={e => { setDatePreset(e.target.value); if (e.target.value !== "custom") updatePreset(e.target.value); }}>
          <option value="all">All dates</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="12">Last 12 months</option><option value="year">This year</option><option value="custom">Custom range</option>
        </Select>
        <label className="field"><span>From date</span><input type="date" value={draftFilters.fromDate ?? ""} onChange={e => { setDatePreset("custom"); setDraftFilters(f => ({ ...f, fromDate: e.target.value || undefined })); }}/></label>
        <label className="field"><span>To date</span><input type="date" value={draftFilters.toDate ?? ""} onChange={e => { setDatePreset("custom"); setDraftFilters(f => ({ ...f, toDate: e.target.value || undefined })); }}/></label>
        <Select label="Validation status" value={draftFilters.status ?? ""} onChange={e => setDraftFilters({ ...draftFilters, status: e.target.value || undefined })}>
          <option value="">All statuses</option><option>Valid</option><option>Invalid</option><option>Pending</option>
        </Select>
        <Select label="Customer" value={draftFilters.customerId ?? ""} onChange={e => setDraftFilters({ ...draftFilters, customerId: e.target.value || undefined })}>
          <option value="">All customers</option>{customers.map(([id, name]) => <option key={id} value={id}>{name} ({id})</option>)}
        </Select>
        <Select label="Operational area" value={draftFilters.sourceArea || ""} onChange={e => setDraftFilters(f => ({ ...f, sourceArea: e.target.value || undefined }))}>
          <option value="">All areas</option>{sources.map(source => <option key={source} value={source}>{source === "Unknown" ? "Unclassified / Unknown" : source}</option>)}
        </Select>
        <Select label="Fine reason" value={draftFilters.reasons[0] ?? ""} onChange={e => setDraftFilters({ ...draftFilters, reasons: e.target.value ? [e.target.value] : [] })}>
          <option value="">All reasons</option>{reasons.map(reason => <option key={reason}>{reason}</option>)}
        </Select>
        <Button variant="ghost" className="reset" onClick={resetFilters}><RotateCcw size={16}/>Reset</Button>
        <Button className="apply-filters" disabled={!filtersChanged} onClick={() => onApplyFilters(draftFilters)}>Apply</Button>
      </Card>

      {remote.loading ? <LoadingPage/> : remote.error ? null : <>
        <div className="dashboard-scope">Showing {filtered.length.toLocaleString()} of {records.length.toLocaleString()} fine records. Fine and invoice measures use the selected filters.{role === "Super User" ? " Activity and account totals below cover the full SQL tables." : role === "Admin" ? " Account totals below cover the full Users table." : ""}</div>
        <div className="kpi-grid">
          <Kpi icon={<FileText />} label="Fine records" value={filtered.length.toLocaleString()} detail="All matching SQL Server fine rows"/>
          <Kpi icon={<CircleDollarSign />} label="Fines imposed" value={money(totalFineAmount)} detail="Fine amount · USD"/>
          <button className="kpi-button" onClick={() => onNavigateFines({ ...filters, status: "Pending" })}>
            <Kpi icon={<Clock3 />} label="Pending validation" value={pending.length.toLocaleString()} detail={`${money(pendingAmount)} fine amount awaiting review`} arrow/>
          </button>
          <Kpi icon={<AlertCircle />} label="Invoice balance outstanding" value={money(outstanding)} detail="Invoice amount less payments received · USD"/>
        </div>

        <Card className="settlement-summary">
          <div><span>Invoice amount</span><strong>{money(invoiceAmount)}</strong></div>
          <div><span>Payments received</span><strong>{money(amountReceived)}</strong></div>
          <div><span>Collection against invoices</span><strong>{invoiceAmount ? `${(collectionRate * 100).toFixed(1)}%` : "—"}</strong></div>
          <small>Payment totals are calculated from the selected fine records. “Fines imposed” and “invoice amount” are separate SQL Server fields.</small>
        </Card>

        {(unclassified > 0 || missingActualDelivery > 0 || missingDeliveredQuantity > 0) && <div className="alert info source-quality"><AlertCircle size={17}/><span><strong>Data coverage:</strong> {unclassified.toLocaleString()} records ({filtered.length ? (unclassified / filtered.length * 100).toFixed(1) : 0}%) have an Unknown or missing operational area; {missingActualDelivery.toLocaleString()} lack an actual delivery date; {missingDeliveredQuantity.toLocaleString()} lack delivered quantity. All matching rows remain included in totals.</span></div>}



        <div className="queue-banner"><div><strong>Pending validation queue</strong><p>{role === "Super User" ? "Review pending cases and record a reasoned status change." : "View pending cases. Status changes are reserved for Super Users."}</p></div><Button variant="secondary" onClick={() => onNavigateFines({ ...filters, status: "Pending" })}>{role === "Super User" ? "Review" : "View"} {pending.length} pending cases</Button></div>

        {!filtered.length ? <Card><EmptyState action={<Button onClick={clearAndApply}>Clear filters</Button>}/></Card> : <div className="chart-grid">
          <StatusDistribution records={filtered}/><FinanceSettlementChart records={filtered}/>
          <ValidationByAreaChart records={filtered} onSelect={sourceArea => onNavigateFines({ ...filters, sourceArea })}/>
          <ReasonsChart records={filtered} onSelect={reason => onNavigateFines({ ...filters, reasons: [reason] })}/>
          <TrendChart records={filtered}/>
        </div>}

        {role !== "Viewer" && overviewError && <p role="alert" className="alert error">{role === "Admin" ? "User" : "Activity and user"} summaries could not be loaded: {overviewError}</p>}
        {role !== "Viewer" && (overviewLoading ? <p role="status" className="dashboard-loading">Loading {role === "Admin" ? "user" : "activity and user"} summaries…</p> : overview && <DatabaseOverview data={overview} role={role} onNavigate={onNavigate}/>)}
      </>}
    </>;
}

function DatabaseOverview({ data, role, onNavigate }) {
    const label = { Validation: "Validation decisions", Finance: "Finance updates", Comment: "Comments", DataEdit: "Fine edits", UserManagement: "User changes" };
    return <section className="database-overview">
      <div className="section-title"><div><span className="eyebrow red">CONNECTED TABLES</span><h2>{role === "Admin" ? "Access overview" : "Activity and access"}</h2><p>{role === "Admin" ? "Summary of SQL Server user accounts." : "Summary of SQL Server activity events and user accounts."}</p></div></div>
      <div className="portfolio-grid">
        {role !== "Admin" && <Card className="portfolio-card">
          <div className="portfolio-heading"><Activity size={18}/><div><h3>ActivityEvents</h3><p>Audit coverage across all dates</p></div></div>
          <div className="portfolio-kpis"><div><strong>{Number(data.activityTotal || 0).toLocaleString()}</strong><span>Total events</span></div><div><strong>{Number(data.activityLast30Days || 0).toLocaleString()}</strong><span>Last 30 days</span></div></div>
          <div className="portfolio-list">{(data.activityByType || []).map(row => <div key={row.type}><span>{label[row.type] || row.type}</span><strong>{Number(row.count).toLocaleString()}</strong></div>)}</div>
          {(data.recentActivity || []).length > 0 && <div className="recent-events"><h4>Latest events</h4>{data.recentActivity.slice(0, 5).map(event => <div key={event.eventId}><span className="event-dot"/><div><strong>{label[event.eventType] || event.eventType}{event.fineId ? ` · Fine ${event.fineId}` : event.targetUserName ? ` · ${event.targetUserName}` : ""}</strong><small>{event.actorName} · {new Date(event.createdAt).toLocaleString()}</small><p>{event.comment}</p></div></div>)}</div>}
          <Button variant="secondary" onClick={() => onNavigate("activity")}>Open full activity log</Button>
        </Card>}
        <Card className="portfolio-card">
          <div className="portfolio-heading"><ShieldCheck size={18}/><div><h3>Users</h3><p>Access state from dbo.Users</p></div></div>
          <div className="portfolio-kpis"><div><strong>{Number(data.userTotal || 0).toLocaleString()}</strong><span>Accounts</span></div><div><strong>{Number(data.activeUsers || 0).toLocaleString()}</strong><span>Active</span></div><div><strong>{Number(data.pendingApprovals || 0).toLocaleString()}</strong><span>Pending approvals</span></div></div>
          <div className="portfolio-list">{(data.activeUsersByRole || []).map(row => <div key={row.role}><span>Active {row.role === "Viewer" ? "User" : row.role}</span><strong>{Number(row.count).toLocaleString()}</strong></div>)}<div><span>Approved but inactive</span><strong>{Number(data.inactiveApprovedUsers || 0).toLocaleString()}</strong></div></div>
          {role === "Admin" && <Button variant="secondary" onClick={() => onNavigate("users")}>Open user management</Button>}
        </Card>
      </div>
    </section>;
}

function Kpi({ icon, label, value, detail, arrow }) {
    return <Card className="kpi"><div className="kpi-top"><span>{icon}</span>{arrow && <ArrowRight size={17}/>}</div><p>{label}</p><strong>{value}</strong><small>{detail}</small></Card>;
}
