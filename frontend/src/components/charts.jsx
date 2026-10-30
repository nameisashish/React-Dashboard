import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Bar, BarChart, Legend } from "recharts";
import { aggregateMonths, aggregateReasons, aggregateStatuses, money, } from "../utils/fines.js";
import { Card, EmptyState, Select } from "./ui.jsx";
import { useState } from "react";
const colors = { Valid: "#067647", Invalid: "#B42318", Pending: "#B54708" };
const tooltipStyle = { borderRadius: 8, borderColor: "#E4E7EC", fontSize: 12 };
export function StatusDistribution({ records }) {
    const data = aggregateStatuses(records);
    const total = data.reduce((sum, row) => sum + row.count, 0);
    return (<Card className="chart-card">
      <div className="card-heading">
        <div>
          <h2>Validation status mix</h2>
          <p>Share of fine records by current validation status.</p>
        </div>
      </div>
      {!records.length ? (<EmptyState />) : (<div className="donut-layout">
          <div className="donut">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="status" innerRadius={65} outerRadius={92} paddingAngle={2}>
                  {data.map((row) => (<Cell key={row.status} fill={colors[row.status]}/>))}
                </Pie>
                <Tooltip formatter={(v) => Number(v).toLocaleString()} contentStyle={tooltipStyle}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <strong>{total.toLocaleString()}</strong>
              <span>Fine records</span>
            </div>
          </div>
          <div className="legend">
            {data.map((row) => (<div key={row.status}>
                <span className={`dot dot-${row.status.toLowerCase()}`}/>
                <span>{row.status}</span>
                <strong>
                  {row.count.toLocaleString()}
                </strong>
                <small>
                  {total ? (row.count / total * 100).toFixed(1) : 0}%
                </small>
              </div>))}
          </div>
        </div>)}
    </Card>);
}
export function ValidationByAreaChart({ records, onSelect }) {
    const totals = new Map();
    for (const fine of records) {
        const sourceArea = fine.sourceArea || "Unknown";
        const row = totals.get(sourceArea) || { sourceArea, area: sourceArea === "Unknown" ? "Unclassified / Unknown" : sourceArea, Valid: 0, Invalid: 0, Pending: 0, total: 0 };
        row[fine.status] = (row[fine.status] || 0) + 1;
        row.total++;
        totals.set(sourceArea, row);
    }
    const data = [...totals.values()].sort((a, b) => b.total - a.total);
    return <Card className="chart-card">
      <div className="card-heading"><div><h2>Validation status by root-cause area</h2><p>Record counts show how the review mix differs across areas, including unclassified fines.</p></div></div>
      {!data.length ? <EmptyState/> : <div className="chart">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 20 }} onClick={state => { const area = state?.activePayload?.[0]?.payload?.sourceArea; if (area) onSelect(area); }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
            <XAxis type="number" allowDecimals={false} tickLine={false}/>
            <YAxis type="category" dataKey="area" width={142} tick={{ fontSize: 10 }} tickLine={false} axisLine={false}/>
            <Tooltip formatter={(value, name) => [`${Number(value).toLocaleString()} fines`, name]} contentStyle={tooltipStyle}/>
            <Legend wrapperStyle={{ fontSize: 10 }}/>
            <Bar dataKey="Invalid" stackId="status" fill={colors.Invalid} barSize={24} cursor="pointer"/>
            <Bar dataKey="Pending" stackId="status" fill={colors.Pending} barSize={24} cursor="pointer"/>
            <Bar dataKey="Valid" stackId="status" fill={colors.Valid} radius={[0, 5, 5, 0]} barSize={24} cursor="pointer"/>
          </BarChart>
        </ResponsiveContainer>
      </div>}
    </Card>;
}

export function FinanceSettlementChart({ records }) {
    const order = ["Unpaid", "AwaitingVerification", "Verified", "Disputed"];
    const data = order.map(status => {
        const rows = records.filter(f => f.financeStatus === status);
        const invoiceAmount = rows.reduce((sum, f) => sum + Number(f.invoiceAmount || 0), 0);
        const amountReceived = rows.reduce((sum, f) => sum + Number(f.amountReceived || 0), 0);
        return { status: status === "AwaitingVerification" ? "Awaiting verification" : status, count: rows.length, invoiceAmount, amountReceived, outstandingAmount: Math.max(0, invoiceAmount - amountReceived) };
    }).filter(row => row.count > 0);
    return <Card className="chart-card">
      <div className="card-heading"><div><h2>Invoice settlement by finance status</h2><p>Invoice value split into payments received and remaining balance · USD.</p></div></div>
      {!records.length || !data.length ? <EmptyState/> : <>
        <div className="chart">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 22 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
              <XAxis type="number" tickFormatter={v => `$${Math.round(v / 1000)}k`} tickLine={false}/>
              <YAxis type="category" dataKey="status" width={125} tick={{ fontSize: 10 }} tickLine={false} axisLine={false}/>
              <Tooltip formatter={v => money(Number(v))} contentStyle={tooltipStyle}/>
              <Legend wrapperStyle={{ fontSize: 10 }}/>
              <Bar dataKey="amountReceived" name="Payments received" stackId="invoice" fill="#067647" barSize={22}/>
              <Bar dataKey="outstandingAmount" name="Outstanding balance" stackId="invoice" fill="#F79009" radius={[0, 5, 5, 0]} barSize={22}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </>}
    </Card>;
}

export function ReasonsChart({ records, onSelect, }) {
    const [metric, setMetric] = useState("amount");
    const [top, setTop] = useState(10);
    const data = aggregateReasons(records)
        .sort((a, b) => b[metric] - a[metric])
        .slice(0, top);
    return (<Card className="chart-card">
      <div className="card-heading">
        <div>
          <h2>Fine reasons</h2>
          <p>Reasons contributing most to recorded fines.</p>
        </div>
        <div className="chart-controls">
          <Select aria-label="Reason metric" value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="amount">Fine Amount</option>
            <option value="count">Fine Count</option>
          </Select>
          <Select aria-label="Top reasons" value={top} onChange={(e) => setTop(Number(e.target.value))}>
            <option value={5}>Top 5</option>
            <option value={10}>All 10</option>
          </Select>
        </div>
      </div>
      {!records.length ? (<EmptyState />) : (<div className="chart chart-tall">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ left: 34, right: 24 }} onClick={(state) => state?.activeLabel && onSelect(String(state.activeLabel))}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
              <XAxis type="number" tickFormatter={(v) => metric === "amount" ? `$${Math.round(v / 1000)}k` : v}/>
              <YAxis type="category" dataKey="reason" width={140} tick={{ fontSize: 11 }} axisLine={false} tickLine={false}/>
              <Tooltip formatter={(v) => metric === "amount" ? money(Number(v)) : Number(v).toLocaleString()} contentStyle={tooltipStyle}/>
              <Bar dataKey={metric} fill="#0F766E" radius={[0, 5, 5, 0]} barSize={18} cursor="pointer"/>
            </BarChart>
          </ResponsiveContainer>
        </div>)}
    </Card>);
}
export function TrendChart({ records }) {
    const [metric, setMetric] = useState("amount");
    const data = aggregateMonths(records);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const includesCurrentMonth = data.at(-1)?.sort === currentMonth;
    return (<Card className="chart-card chart-wide">
      <div className="card-heading">
        <div>
          <h2>Fine trend by date</h2>
          <p>Monthly totals use fine date.{includesCurrentMonth ? " The current month is month-to-date." : ""}</p>
        </div>
        <Select aria-label="Trend metric" value={metric} onChange={(e) => setMetric(e.target.value)}>
          <option value="amount">Fine Amount</option>
          <option value="count">Fine Count</option>
        </Select>
      </div>
      {!records.length ? (<EmptyState />) : (<div className="chart chart-tall">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ left: 4, right: 20, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false}/>
              <XAxis dataKey="month" tickLine={false} tick={{ fontSize: 11 }}/>
              <YAxis tickFormatter={(v) => metric === "amount" ? `$${Math.round(v / 1000)}k` : v} tickLine={false}/>
              <Tooltip formatter={(v) => metric === "amount" ? money(Number(v)) : Number(v).toLocaleString()} contentStyle={tooltipStyle}/>
              <Line type="monotone" dataKey={metric} stroke="#0F766E" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>)}
    </Card>);
}
