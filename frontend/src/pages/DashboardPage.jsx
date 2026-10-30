import { useFines } from "../services/useFines.js";
import { AlertCircle, ArrowRight, CircleDollarSign, Clock3, FileText, RotateCcw, } from "lucide-react";
import { useMemo, useState } from "react";
import { ReasonsChart, StatusAmountChart, StatusDistribution, TrendChart, } from "../components/charts.jsx";
import { Button, Card, EmptyState, LoadingPage, Select } from "../components/ui.jsx";

import { filterFines, last12Months, money } from "../utils/fines.js";
export function DashboardPage({ records, onNavigateFines, }) {
    const defaults = {
        ...last12Months(),
        status: undefined,
        customerId: undefined,
        reasons: [],
    };
    const [filters, setFilters] = useState(defaults);
    const [datePreset, setDatePreset] = useState("12");
    const resetFilters = () => {
        setFilters(defaults);
        setDatePreset("12");
    };
    const remote = useFines(filters, records);
    const filtered = useMemo(() => filterFines(remote.rows, filters), [remote.rows, filters]);
    const pending = filtered.filter((f) => f.status === "Pending");
    const totalAmount = filtered.reduce((sum, f) => sum + f.fineAmount, 0);
    const pendingAmount = pending.reduce((sum, f) => sum + f.fineAmount, 0);
    const reasons = [...new Set(records.map(f => f.reasonCategory))];
    const customers = Array.from(new Map(records.map((f) => [f.customerId, f.customerName])));
    const updatePreset = (preset) => {
        const to = new Date();
        const from = new Date();
        if (preset === "30")
            from.setDate(from.getDate() - 30);
        else if (preset === "90")
            from.setDate(from.getDate() - 90);
        else if (preset === "year")
            from.setMonth(0, 1);
        else
            from.setFullYear(from.getFullYear() - 1);
        setFilters((f) => ({
            ...f,
            fromDate: from.toISOString().slice(0, 10),
            toDate: to.toISOString().slice(0, 10),
        }));
    };
    return (<>
      {remote.loading && <p role="status">Loading records…</p>}
      {remote.error && <p role="alert" className="alert error">Unable to load records: {remote.error}. <Button onClick={remote.retry}>Retry</Button></p>}
      <Card className="filter-bar sticky-filters">
        <Select label="Fine date" value={datePreset} onChange={(e) => {
            setDatePreset(e.target.value);
            updatePreset(e.target.value);
        }}>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="12">Last 12 months</option>
          <option value="year">This year</option>
        </Select>
        <Select label="Status" value={filters.status ?? ""} onChange={(e) => setFilters({
            ...filters,
            status: e.target.value || undefined,
        })}>
          <option value="">All statuses</option>
          <option>Valid</option>
          <option>Invalid</option>
          <option>Pending</option>
        </Select>
        <Select label="Customer" value={filters.customerId ?? ""} onChange={(e) => setFilters({ ...filters, customerId: e.target.value || undefined })}>
          <option value="">All customers</option>
          {customers.map(([id, name]) => (<option key={id} value={id}>
              {name}
            </option>))}
        </Select>
        <Select label="Operational area" value={filters.sourceArea || ""} onChange={e => setFilters(f => ({ ...f, sourceArea: e.target.value || undefined }))}>
          <option value="">All areas</option><option>Logistics</option><option>Warehouse</option><option>Manufacturing</option>
        </Select>
        <Select label="Fine reason" value={filters.reasons[0] ?? ""} onChange={(e) => setFilters({
            ...filters,
            reasons: e.target.value ? [e.target.value] : [],
        })}>
          <option value="">All reasons</option>
          {reasons.map((reason) => (<option key={reason}>{reason}</option>))}
        </Select>
        <Button variant="ghost" className="reset" onClick={resetFilters}>
          <RotateCcw size={16}/>
          Reset
        </Button>
      </Card>
      {remote.loading ? <LoadingPage/> : remote.error ? null : <>
      <div className="kpi-grid">
        <Kpi icon={<FileText />} label="Total Fines" value={filtered.length.toLocaleString()} detail="Fine cases in the selected period"/>
        <Kpi icon={<CircleDollarSign />} label="Total Deductions" value={money(totalAmount)} detail="Gross recorded amount · USD"/>
        <button className="kpi-button" onClick={() => onNavigateFines({ ...filters, status: "Pending" })}>
          <Kpi icon={<Clock3 />} label="Pending Cases" value={pending.length.toLocaleString()} detail="Awaiting manual review" arrow/>
        </button>
        <Kpi icon={<AlertCircle />} label="Pending Amount" value={money(pendingAmount)} detail="Amount associated with unresolved cases"/>
      </div>
      <div className="source-grid">{["Logistics", "Warehouse", "Manufacturing"].map(source => <button key={source} onClick={() => onNavigateFines({ ...filters, sourceArea: source })}><span>{source}</span><strong>{money(filtered.filter(f => f.sourceArea === source).reduce((sum, f) => sum + f.fineAmount, 0))}</strong><small>Recorded deductions →</small></button>)}</div>
      <div className="queue-banner"><div><strong>Pending review queue</strong><p>Resolve missing evidence with a comment and a traceable decision.</p></div><Button variant="secondary" onClick={() => onNavigateFines({ ...filters, status: 'Pending' })}>Review {pending.length} pending cases</Button></div>
      {!filtered.length ? (<Card>
          <EmptyState action={<Button onClick={resetFilters}>
                Clear filters
              </Button>}/>
        </Card>) : (<>
          <div className="chart-grid">
            <StatusDistribution records={filtered}/>
            <StatusAmountChart records={filtered}/>
            <ReasonsChart records={filtered} onSelect={(reason) => onNavigateFines({ ...filters, reasons: [reason] })}/>
            <TrendChart records={filtered}/>
          </div>
        </>)}
      </>}
    </>);
}
function Kpi({ icon, label, value, detail, arrow, }) {
    return (<Card className="kpi">
      <div className="kpi-top">
        <span>{icon}</span>
        {arrow && <ArrowRight size={17}/>}
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </Card>);
}
