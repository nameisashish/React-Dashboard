import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Bar, BarChart, } from "recharts";
import { aggregateMonths, aggregateReasons, aggregateStatuses, money, } from "../utils/fines.js";
import { Card, EmptyState, Select } from "./ui.jsx";
import { useState } from "react";
const colors = { Valid: "#067647", Invalid: "#B42318", Pending: "#B54708" };
const tooltipStyle = { borderRadius: 8, borderColor: "#E4E7EC", fontSize: 12 };
export function StatusDistribution({ records }) {
    const [metric, setMetric] = useState("count");
    const data = aggregateStatuses(records);
    const total = data.reduce((sum, row) => sum + row[metric], 0);
    return (<Card className="chart-card">
      <div className="card-heading">
        <div>
          <h2>Fine Status Distribution</h2>
          <p>Proportion of recorded fines by status.</p>
        </div>
        <div className="segmented">
          <button className={metric === "count" ? "active" : ""} onClick={() => setMetric("count")}>
            Count
          </button>
          <button className={metric === "amount" ? "active" : ""} onClick={() => setMetric("amount")}>
            Amount
          </button>
        </div>
      </div>
      {!records.length ? (<EmptyState />) : (<div className="donut-layout">
          <div className="donut">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey={metric} nameKey="status" innerRadius={65} outerRadius={92} paddingAngle={2}>
                  {data.map((row) => (<Cell key={row.status} fill={colors[row.status]}/>))}
                </Pie>
                <Tooltip formatter={(v) => metric === "amount"
                ? money(Number(v))
                : Number(v).toLocaleString()} contentStyle={tooltipStyle}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <strong>{metric === "amount" ? money(total) : total}</strong>
              <span>
                {metric === "amount" ? "Recorded amount" : "Total fines"}
              </span>
            </div>
          </div>
          <div className="legend">
            {data.map((row) => (<div key={row.status}>
                <span className={`dot dot-${row.status.toLowerCase()}`}/>
                <span>{row.status}</span>
                <strong>
                  {metric === "amount" ? money(row.amount) : row.count}
                </strong>
                <small>
                  {total ? Math.round((row[metric] / total) * 100) : 0}%
                </small>
              </div>))}
          </div>
        </div>)}
    </Card>);
}
export function StatusAmountChart({ records }) {
    const data = aggregateStatuses(records);
    return (<Card className="chart-card">
      <div className="card-heading">
        <div>
          <h2>Fine Amount by Status</h2>
          <p>Recorded financial amount in INR.</p>
        </div>
      </div>
      {!records.length ? (<EmptyState />) : (<div className="chart">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
              <XAxis type="number" tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} tickLine={false}/>
              <YAxis type="category" dataKey="status" width={64} tickLine={false} axisLine={false}/>
              <Tooltip formatter={(v) => money(Number(v))} contentStyle={tooltipStyle}/>
              <Bar dataKey="amount" radius={[0, 5, 5, 0]} barSize={24}>
                {data.map((row) => (<Cell key={row.status} fill={colors[row.status]}/>))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>)}
    </Card>);
}
export function ReasonsChart({ records, onSelect, }) {
    const [metric, setMetric] = useState("amount");
    const [top, setTop] = useState(5);
    const data = aggregateReasons(records)
        .sort((a, b) => b[metric] - a[metric])
        .slice(0, top);
    return (<Card className="chart-card chart-wide">
      <div className="card-heading">
        <div>
          <h2>Top Fine Reasons</h2>
          <p>Reasons contributing most to recorded fines.</p>
        </div>
        <div className="chart-controls">
          <Select aria-label="Reason metric" value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="amount">Fine Amount</option>
            <option value="count">Fine Count</option>
          </Select>
          <Select aria-label="Top reasons" value={top} onChange={(e) => setTop(Number(e.target.value))}>
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
          </Select>
        </div>
      </div>
      {!records.length ? (<EmptyState />) : (<div className="chart chart-tall">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ left: 34, right: 24 }} onClick={(state) => state?.activeLabel && onSelect(String(state.activeLabel))}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
              <XAxis type="number" tickFormatter={(v) => metric === "amount" ? `₹${Math.round(v / 1000)}k` : v}/>
              <YAxis type="category" dataKey="reason" width={140} tick={{ fontSize: 11 }} axisLine={false} tickLine={false}/>
              <Tooltip formatter={(v) => metric === "amount" ? money(Number(v)) : Number(v)} contentStyle={tooltipStyle}/>
              <Bar dataKey={metric} fill="#0F766E" radius={[0, 5, 5, 0]} barSize={18} cursor="pointer"/>
            </BarChart>
          </ResponsiveContainer>
        </div>)}
    </Card>);
}
export function TrendChart({ records }) {
    const [metric, setMetric] = useState("amount");
    const data = aggregateMonths(records);
    return (<Card className="chart-card chart-wide">
      <div className="card-heading">
        <div>
          <h2>Fine Trend Over Time</h2>
          <p>Fine activity across the selected period.</p>
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
              <YAxis tickFormatter={(v) => metric === "amount" ? `₹${Math.round(v / 1000)}k` : v} tickLine={false}/>
              <Tooltip formatter={(v) => metric === "amount" ? money(Number(v)) : Number(v)} contentStyle={tooltipStyle}/>
              <Line type="monotone" dataKey={metric} stroke="#0F766E" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>)}
    </Card>);
}
