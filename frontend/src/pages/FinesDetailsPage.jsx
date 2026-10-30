import { useFines } from "../services/useFines.js";
import { ArrowDown, ArrowUp, Download, FilterX, MoreHorizontal, RefreshCw, } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Card, EmptyState, SearchField, Select, StatusBadge, } from "../components/ui.jsx";

import { exactMoney, filterFines, shortDate } from "../utils/fines.js";
export function FinesDetailsPage({ records, role, initialFilters, onOpen, onExport, onRefresh, }) {
    const [filters, setFilters] = useState({
        reasons: [],
        ...initialFilters,
    });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sort, setSort] = useState({
        field: "fineDate",
        direction: "desc",
    });
    const reasons = [...new Set(records.map(f => f.reasonCategory))];
    const customers = Array.from(new Map(records.map((f) => [f.customerId, f.customerName])));
    const remote = useFines(filters, records);
    const filtered = useMemo(() => filterFines(remote.rows, filters).sort((a, b) => {
        const result = sort.field === "fineAmount"
            ? a.fineAmount - b.fineAmount
            : a.fineDate.localeCompare(b.fineDate);
        return sort.direction === "asc" ? result : -result;
    }), [remote.rows, filters, sort]);
    const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(page, maxPage);
    const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const update = (partial) => {
        setFilters((f) => ({ ...f, ...partial }));
        setPage(1);
    };
    const clearFilters = () => {
        setFilters({ reasons: [] });
        setPage(1);
    };
    const toggleSort = (field) => setSort((s) => ({
        field,
        direction: s.field === field && s.direction === "desc" ? "asc" : "desc",
    }));
    const SortIcon = ({ field }) => sort.field === field ? (sort.direction === "asc" ? (<ArrowUp size={13}/>) : (<ArrowDown size={13}/>)) : null;
    return (<>
      {remote.loading && <p role="status">Loading records…</p>}
      {remote.error && <p role="alert" className="alert error">Unable to load records: {remote.error}. Use Refresh or change a filter to retry.</p>}
      <Card className="records-card sticky-filters records-filters">
        <div className="records-search">
          <SearchField value={filters.search ?? ""} onChange={(search) => update({ search })} placeholder="Search Fine ID, Customer ID, or Order Reference…"/>
          <div>
            <Button variant="secondary" onClick={onRefresh}>
              <RefreshCw size={16}/>
              Refresh
            </Button>
            <Button onClick={() => onExport(filtered, filters)}>
              <Download size={16}/>
              Export to Excel
            </Button>
          </div>
        </div>
        <div className="details-filters">
          <label className="field">
            <span>From date</span>
            <input type="date" value={filters.fromDate ?? ""} onChange={(e) => update({ fromDate: e.target.value || undefined })}/>
          </label>
          <label className="field">
            <span>To date</span>
            <input type="date" value={filters.toDate ?? ""} onChange={(e) => update({ toDate: e.target.value || undefined })}/>
          </label>
          <Select label="Status" value={filters.status ?? ""} onChange={(e) => update({
            status: e.target.value || undefined,
        })}>
            <option value="">All statuses</option>
            <option>Valid</option>
            <option>Invalid</option>
            <option>Pending</option>
          </Select>
          <Select label="Customer" value={filters.customerId ?? ""} onChange={(e) => update({ customerId: e.target.value || undefined })}>
            <option value="">All customers</option>
            {customers.map(([id, name]) => (<option key={id} value={id}>
                {name}
              </option>))}
          </Select>
          <Select label="Operational area" value={filters.sourceArea || ""} onChange={e => setFilters(f => ({ ...f, sourceArea: e.target.value || undefined }))}>
          <option value="">All areas</option><option>Logistics</option><option>Warehouse</option><option>Manufacturing</option>
        </Select>
        <Select label="Fine reason" value={filters.reasons[0] ?? ""} onChange={(e) => update({ reasons: e.target.value ? [e.target.value] : [] })}>
            <option value="">All reasons</option>
            {reasons.map((reason) => (<option key={reason}>{reason}</option>))}
          </Select>
          <Button variant="ghost" onClick={clearFilters}>
            <FilterX size={16}/>
            Clear all
          </Button>
        </div>
        {(filters.status ||
            filters.customerId ||
            filters.reasons.length > 0 ||
            filters.search) && (<div className="filter-chips">
            <span>Active filters:</span>
            {filters.status && (<button onClick={() => update({ status: undefined })}>
                Status: {filters.status} ×
              </button>)}
            {filters.customerId && (<button onClick={() => update({ customerId: undefined })}>
                Customer: {filters.customerId} ×
              </button>)}
            {filters.reasons.map((reason) => (<button key={reason} onClick={() => update({ reasons: [] })}>
                {reason} ×
              </button>))}
            {filters.search && (<button onClick={() => update({ search: "" })}>
                Search: “{filters.search}” ×
              </button>)}
          </div>)}
      </Card>
      <Card className="records-card table-card">
        <div className="table-toolbar">
          <span>{filtered.length.toLocaleString()} results</span>
          <label>
            Rows per page{" "}
            <select value={pageSize} onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
        }}>
              <option>10</option>
              <option>25</option>
              <option>50</option>
            </select>
          </label>
        </div>
        {!filtered.length ? (<EmptyState action={<Button onClick={clearFilters}>
                Clear filters
              </Button>}/>) : (<div className="table-wrap main-table">
            <table>
              <thead>
                <tr>
                  <th>Fine ID</th>
                  <th>Customer ID</th>
                  <th>Order reference</th>
                  <th>
                    <button onClick={() => toggleSort("fineDate")}>
                      Fine date <SortIcon field="fineDate"/>
                    </button>
                  </th>
                  <th className="numeric">
                    <button onClick={() => toggleSort("fineAmount")}>
                      Fine amount <SortIcon field="fineAmount"/>
                    </button>
                  </th>
                  <th>Currency</th>
                  <th>Fine reason</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((fine) => (<tr key={fine.fineId}>
                    <td>
                      <button className="table-link" onClick={() => onOpen(fine)}>
                        {fine.fineId}
                      </button>
                    </td>
                    <td>
                      {fine.customerId}
                      <small>{fine.customerName}</small>
                    </td>
                    <td>{fine.orderReference}</td>
                    <td>{shortDate(fine.fineDate)}</td>
                    <td className="numeric">
                      <strong>{exactMoney(fine.fineAmount)}</strong>
                    </td>
                    <td>{fine.currencyCode}</td>
                    <td>
                      <span className="truncate" title={fine.reasonCategory}>
                        {fine.reasonCategory}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={fine.status}/>
                    </td>
                    <td>{shortDate(fine.updatedAt)}</td>
                    <td>
                      <div className="row-actions">
                        {(role === "Admin" || role === "Super User") ? (<Button variant="secondary" onClick={() => onOpen(fine, true)}>
                            Review
                          </Button>) : (<button className="icon-btn" onClick={() => onOpen(fine)} aria-label={`View ${fine.fineId}`}>
                            <MoreHorizontal size={18}/>
                          </button>)}
                      </div>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}
        <div className="pagination">
          <span>
            Showing {filtered.length ? (currentPage - 1) * pageSize + 1 : 0}–
            {Math.min(currentPage * pageSize, filtered.length)} of{" "}
            {filtered.length} records
          </span>
          <div>
            <Button variant="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
              Previous
            </Button>
            <span>
              Page {currentPage} of {maxPage}
            </span>
            <Button variant="secondary" disabled={currentPage === maxPage} onClick={() => setPage(currentPage + 1)}>
              Next
            </Button>
          </div>
        </div>
      </Card>
    </>);
}
