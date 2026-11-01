import { useState } from "react";
import { Button, Modal } from "./ui.jsx";

const reasons = [
  "Promotional / Contract Dispute",
  "Labelling / Compliance",
  "Incorrect Product",
  "Missed Delivery Appointment",
  "Quality Rejection",
  "Pricing Discrepancy",
  "Missing Documentation",
  "Damaged Goods",
  "Late Delivery",
  "Short Delivery",
];

export function FineRequestModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    customerId: "",
    customerName: "",
    orderReference: "",
    fineDate: new Date().toISOString().slice(0, 10),
    fineAmount: "",
    sourceArea: "Logistics",
    reasonCategory: reasons[0],
    requestComment: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    if (!form.customerId.trim() || !form.fineAmount || Number(form.fineAmount) <= 0 || !form.requestComment.trim()) {
      setError("Enter a customer ID, a positive fine amount, and a comment for the reviewer.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit({ ...form, fineAmount: Number(form.fineAmount), status: "Pending" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The fine request could not be submitted.");
      setSaving(false);
    }
  }

  return <Modal title="Submit Fine Request" onClose={() => !saving && onClose()} className="fine-request-modal">
    <form className="modal-body fine-request-form" onSubmit={submit}>
      <p>Your request and comment will be sent to the Super User for review. It will start as Pending.</p>
      {error && <div className="alert error" role="alert">{error}</div>}
      <div className="request-fields">
        <label className="form-field"><span>Customer ID *</span><div><input value={form.customerId} onChange={e => update("customerId", e.target.value)} maxLength={30} required /></div></label>
        <label className="form-field"><span>Customer name</span><div><input value={form.customerName} onChange={e => update("customerName", e.target.value)} maxLength={120} /></div></label>
        <label className="form-field"><span>Order reference</span><div><input value={form.orderReference} onChange={e => update("orderReference", e.target.value)} maxLength={40} /></div></label>
        <label className="form-field"><span>Fine date *</span><div><input type="date" value={form.fineDate} onChange={e => update("fineDate", e.target.value)} required /></div></label>
        <label className="form-field"><span>Fine amount (USD) *</span><div><input type="number" min="0.01" step="0.01" value={form.fineAmount} onChange={e => update("fineAmount", e.target.value)} required /></div></label>
        <label className="form-field"><span>Operational area *</span><div><select value={form.sourceArea} onChange={e => update("sourceArea", e.target.value)}><option>Logistics</option><option>Warehouse</option><option>Manufacturing</option></select></div></label>
        <label className="form-field request-wide"><span>Fine reason *</span><div><select value={form.reasonCategory} onChange={e => update("reasonCategory", e.target.value)}>{reasons.map(reason => <option key={reason}>{reason}</option>)}</select></div></label>
        <label className="comment-field request-wide"><span>Comment for the Super User *</span><textarea value={form.requestComment} onChange={e => update("requestComment", e.target.value)} maxLength={1000} required placeholder="Explain the request and include supporting context."/><div><small>{form.requestComment.length}/1,000</small></div></label>
      </div>
      <div className="modal-actions"><Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit Pending Request"}</Button></div>
    </form>
  </Modal>;
}
