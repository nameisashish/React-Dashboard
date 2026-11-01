import { useId } from "react";
import { useDialog } from "./useDialog.js";
import { AlertTriangle, CheckCircle2, ChevronDown, LoaderCircle, Search, X, } from "lucide-react";
export function Button({ className = "", variant = "primary", type = "button", ...props }) {
    return <button type={type} className={`btn btn-${variant} ${className}`} {...props}/>;
}
export function StatusBadge({ status }) {
    return (<span className={`status status-${status.toLowerCase()}`}>
      <span aria-hidden="true"/>
      {status}
    </span>);
}
export function Select({ label, className = "", ...props }) {
    return (<label className={`field ${className}`}>
      {label && <span>{label}</span>}
      <span className="select-wrap">
        <select {...props}/>
        <ChevronDown size={15} aria-hidden="true"/>
      </span>
    </label>);
}
export function Card({ children, className = "", }) {
    return <section className={`card ${className}`}>{children}</section>;
}
export function Toast({ message, type = "success", onClose, }) {
    return (<div className={`toast toast-${type}`} role="status">
      {type === "success" ? (<CheckCircle2 size={19}/>) : (<AlertTriangle size={19}/>)}
      <span>{message}</span>
      <button onClick={onClose} aria-label="Dismiss notification">
        <X size={16}/>
      </button>
    </div>);
}
export function LoadingPage() {
    return (<div className="loading-page" role="status" aria-label="Loading fine records">
      <LoaderCircle className="spin" size={28}/>
      <p>Loading fine records…</p>
      <div className="skeleton-grid">
        {[1, 2, 3, 4].map((x) => (<div className="skeleton" key={x}/>))}
      </div>
    </div>);
}
export function EmptyState({ title = "No fines found", description = "No records match your current search and filters.", action, }) {
    return (<div className="empty-state">
      <Search size={28}/>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>);
}
export function Modal({ title, children, onClose, className = "", }) {
    const dialogRef = useDialog(onClose);
    const titleId = useId();
    return (<div className="overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className={`modal ${className}`} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <X size={20}/>
          </button>
        </header>
        {children}
      </section>
    </div>);
}
