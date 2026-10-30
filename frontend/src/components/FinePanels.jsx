import { useDialog } from "./useDialog.js";
import { AlertTriangle, Calendar, CheckCircle2, CircleDollarSign, Clock3, FileText, UserRound, } from "lucide-react";
import { useState } from "react";
import { dateTime, exactMoney, shortDate } from "../utils/fines.js";
import { Button, Modal, StatusBadge } from "./ui.jsx";
import { canReviewFine } from "../services/permissions.js";
export function FineDrawer({ fine, role, history, historyError, onClose, onReview, }) {
    const dialogRef = useDialog(onClose);
    const detail = (label, value) => (<div>
      <dt>{label}</dt>
      <dd>{value ?? "Not available"}</dd>
    </div>);
    return (<div className="drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside ref={dialogRef} tabIndex={-1} className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header>
          <div>
            <span>FINE RECORD</span>
            <h2 id="drawer-title">{fine.fineId}</h2>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="drawer-summary">
          <div>
            <StatusBadge status={fine.status}/>
            <strong>{exactMoney(fine.fineAmount)}</strong>
            <span>{fine.currencyCode}</span>
          </div>
          {canReviewFine(role, fine.status) && (<Button onClick={onReview}>Review Fine</Button>)}
        </div>
        <section>
          <h3>Fine information</h3>
          <dl className="details-grid">
            {detail("Fine ID", fine.fineId)}
            {detail("Customer", `${fine.customerName} (${fine.customerId})`)}
            {detail("Order reference", fine.orderReference)}
            {detail("Invoice ID", fine.invoiceId)}
            {detail("Fine date", shortDate(fine.fineDate))}
            {detail("Fine amount", exactMoney(fine.fineAmount))}
            {detail("Currency", fine.currencyCode)}
            {detail("Fine reason", fine.reasonCategory)}
            {detail("Source area", fine.sourceArea)}
            <div className="full">
              <dt>Reason description</dt>
              <dd>{fine.reasonDescription ?? "Not available"}</dd>
            </div>
            {detail("Created at", dateTime(fine.createdAt))}
            {detail("Last updated", dateTime(fine.updatedAt))}
          </dl>
        </section>
        <section>
          <h3>Delivery and quantity</h3>
          <dl className="details-grid">
            {detail("Expected delivery", fine.expectedDeliveryDate && shortDate(fine.expectedDeliveryDate))}
            {detail("Actual delivery", fine.actualDeliveryDate && shortDate(fine.actualDeliveryDate))}
            {detail("Ordered quantity", fine.orderedQuantity)}
            {detail("Produced quantity", fine.producedQuantity)}
            {detail("Dispatched quantity", fine.dispatchedQuantity)}
            {detail("Delivered quantity", fine.deliveredQuantity)}
            <div className="full"><dt>Evidence notes</dt><dd>{fine.reasonDescription || "Not available"}</dd></div>
          </dl>
        </section>
        <section>
          <h3>Invoice and payment</h3>
          <dl className="details-grid">
            {detail("Finance status", fine.financeStatus)}
            {detail("Invoice amount", fine.invoiceAmount != null ? exactMoney(fine.invoiceAmount) : null)}
            {detail("Amount received", fine.amountReceived != null ? exactMoney(fine.amountReceived) : null)}
            {detail("Outstanding balance", fine.invoiceAmount != null ? exactMoney(Math.max(0, fine.invoiceAmount - (fine.amountReceived || 0))) : null)}
            {detail("Payment due", fine.paymentDueDate && shortDate(fine.paymentDueDate))}
            {detail("Retailer paid", fine.retailerPaidAt && dateTime(fine.retailerPaidAt))}
            {detail("Payment received", fine.paymentReceivedAt && dateTime(fine.paymentReceivedAt))}
            {detail("Payment verified", fine.paymentVerifiedAt && dateTime(fine.paymentVerifiedAt))}
          </dl>
        </section>
        <section>
          <h3>Review summary</h3>
          {fine.lastReviewedAt ? (<dl className="details-grid">
              {detail("Last reviewer", fine.lastReviewerName)}
              {detail("Review date", dateTime(fine.lastReviewedAt))}
              <div className="full">
                <dt>Latest comment</dt>
                <dd>{fine.lastReviewComment}</dd>
              </div>
            </dl>) : (<div className="no-history">
              <Clock3 size={18}/>
              No manual review recorded.
            </div>)}
        </section>
        <section>
          <h3>
            Review history <span>{history.length}</span>
          </h3>
          {historyError ? <p role="alert" className="alert error">{historyError}</p> : !history.length ? (<div className="no-history">No manual review recorded.</div>) : (<div className="timeline">
              {history.map((item) => (<div key={item.reviewId}>
                  <span className={`timeline-dot ${item.newStatus.toLowerCase()}`}/>
                  <div>
                    <strong>
                      {item.oldStatus} → {item.newStatus}
                    </strong>
                    <span>
                      {dateTime(item.reviewedAt)} · {item.reviewerName}
                    </span>
                    <p>{item.comment}</p>
                  </div>
                </div>))}
            </div>)}
        </section>
      </aside>
    </div>);
}
export function ReviewModal({ fine, role, onClose, onSave, }) {
    const [decision, setDecision] = useState("");
    const [comment, setComment] = useState("");
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [apiError, setApiError] = useState("");
    const submit = async () => {
        const next = {};
        if (!decision)
            next.decision = "Select a target status.";
        if (!comment.trim())
            next.comment = "Please enter a review comment.";
        if (comment.length > 1000)
            next.comment = "Comment must be 1,000 characters or fewer.";
        if (role === "Viewer")
            next.permission = "You do not have permission to review fines.";
        setErrors(next);
        if (Object.keys(next).length)
            return;
        setSaving(true);
        setApiError("");
        try {
            await onSave({
                decision: decision,
                comment: comment.trim(),
                expectedStatus: fine.status,
                expectedVersion: fine.version,
            });
        }
        catch (error) {
            setApiError(error instanceof Error && error.message === "conflict"
                ? "This fine was updated by another reviewer. Refresh the record before continuing."
                : error instanceof Error && error.message === "admin-required-for-invalid-review"
                    ? "Only an Admin can change the review comment or status of an Invalid fine."
                    : "We could not save your decision. Your changes have not been confirmed. Please retry.");
            setSaving(false);
        }
    };
    return (<Modal title="Review Fine Status" onClose={() => { if (!saving) onClose(); }} className="review-modal">
      <div className="modal-body">
        <div className="review-record">
          <div>
            <FileText />
            <span>
              Fine ID<strong>{fine.fineId}</strong>
            </span>
          </div>
          <div>
            <UserRound />
            <span>
              Customer<strong>{fine.customerId}</strong>
            </span>
          </div>
          <div>
            <CircleDollarSign />
            <span>
              Fine amount<strong>{exactMoney(fine.fineAmount)}</strong>
            </span>
          </div>
          <div>
            <Calendar />
            <span>
              Fine date<strong>{shortDate(fine.fineDate)}</strong>
            </span>
          </div>
        </div>
        <div className="current-status">
          <span>Current status</span>
          <StatusBadge status={fine.status}/>
        </div>
        {(apiError || errors.permission) && (<div className="alert error">
            <AlertTriangle size={18}/>
            <span>{apiError || errors.permission}</span>
          </div>)}
        <fieldset className="decision">
          <legend>
            Review Decision <span>*</span>
          </legend>
          <p>Select the target status for this fine.</p>
          <div>
            <label className={decision === "Valid" ? "selected valid" : ""}>
              <input type="radio" name="decision" value="Valid" checked={decision === "Valid"} onChange={() => setDecision("Valid")}/>
              <CheckCircle2 />
              <span>
                <strong>Valid</strong>
                <small>Confirm the fine classification as valid.</small>
              </span>
            </label>
            <label className={decision === "Invalid" ? "selected invalid" : ""}>
              <input type="radio" name="decision" value="Invalid" checked={decision === "Invalid"} onChange={() => setDecision("Invalid")}/>
              <AlertTriangle />
              <span>
                <strong>Invalid</strong>
                <small>Mark the fine classification as invalid.</small>
              </span>
            </label>
            <label className={decision === "Pending" ? "selected" : ""}><input type="radio" name="decision" value="Pending" checked={decision === "Pending"} onChange={() => setDecision("Pending")}/><Clock3 /><span><strong>Pending</strong><small>Return this fine to the pending queue.</small></span></label>
          </div>
          {errors.decision && (<small className="field-error">{errors.decision}</small>)}
        </fieldset>
        <label className="comment-field">
          <span>
            Reviewer Comment <b>*</b>
          </span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="Explain the reason for your decision…" aria-invalid={!!errors.comment}/>
          <div>
            <small className={errors.comment ? "field-error" : ""}>
              {errors.comment ??
            "Provide a clear explanation to document this review."}
            </small>
            <small>{comment.length}/1,000</small>
          </div>
        </label>
        {decision && comment.trim() && !errors.comment && (<div className="confirmation">
            <strong>Decision summary</strong>
            <p>
              You are about to change this fine from {fine.status} to{" "}
              <b>{decision}</b>. This decision and your comment will be recorded
              in review history.
            </p>
          </div>)}
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save Decision"}
          </Button>
        </div>
      </div>
    </Modal>);
}
export function ExportModal({ count, filters, onClose, onExport, }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    return (<Modal title="Export Fine Records" onClose={onClose}>
      <div className="modal-body export-modal">
        {error && <p role="alert" className="field-error">{error}</p>}
        <p>
          Download all records matching the current search and filters, across
          every table page.
        </p>
        <dl>
          {Object.entries(filters).map(([key, value]) => (<div key={key}>
              <dt>
                {key === "date"
                ? "Fine date"
                : key[0].toUpperCase() + key.slice(1)}
              </dt>
              <dd>{value || "All"}</dd>
            </div>))}
          <div>
            <dt>Matching records</dt>
            <dd>
              <strong>{count.toLocaleString()}</strong>
            </dd>
          </div>
        </dl>
        <div className="alert info">
          <FileText size={18}/>
          <span>
            The workbook includes the USD reporting context and
            preserves monetary precision.
          </span>
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={loading || !count} onClick={async () => {
            setLoading(true);
            try { await onExport(); } catch { setError("Unable to export. Please retry."); } finally { setLoading(false); }
        }}>
            {loading ? "Preparing workbook…" : "Download Excel"}
          </Button>
        </div>
      </div>
    </Modal>);
}
