-- Read-only profile used to align dashboard views with the live SQL Server dataset.
-- Every statement is an aggregate SELECT over dbo.Fines, dbo.Users, or dbo.ActivityEvents.

SELECT
    COUNT_BIG(*) AS fine_rows,
    MIN(fine_date) AS first_fine_date,
    MAX(fine_date) AS last_fine_date,
    SUM(fine_amount) AS fine_amount_total,
    SUM(invoice_amount) AS invoice_total,
    SUM(amount_received) AS amount_received_total,
    SUM(CASE WHEN root_cause_area = 'Unknown' THEN 1 ELSE 0 END) AS unknown_area_rows,
    SUM(CASE WHEN customer_id IS NULL OR LTRIM(RTRIM(customer_id)) = '' THEN 1 ELSE 0 END) AS missing_customer_rows,
    SUM(CASE WHEN fine_reason IS NULL OR LTRIM(RTRIM(fine_reason)) = '' THEN 1 ELSE 0 END) AS missing_reason_rows,
    SUM(CASE WHEN invoice_amount < amount_received THEN 1 ELSE 0 END) AS overpaid_invoice_rows,
    SUM(CASE WHEN fine_amount < 0 OR invoice_amount < 0 OR amount_received < 0 THEN 1 ELSE 0 END) AS negative_amount_rows
FROM dbo.Fines;

SELECT validation_status, COUNT_BIG(*) AS fine_rows, SUM(fine_amount) AS fine_amount
FROM dbo.Fines
GROUP BY validation_status
ORDER BY validation_status;

SELECT
    COALESCE(NULLIF(LTRIM(RTRIM(root_cause_area)), ''), '(missing)') AS root_cause_area,
    validation_status,
    COUNT_BIG(*) AS fine_rows,
    SUM(fine_amount) AS fine_amount
FROM dbo.Fines
GROUP BY COALESCE(NULLIF(LTRIM(RTRIM(root_cause_area)), ''), '(missing)'), validation_status
ORDER BY root_cause_area, validation_status;

SELECT
    finance_status,
    COUNT_BIG(*) AS fine_rows,
    SUM(invoice_amount) AS invoice_amount,
    SUM(amount_received) AS amount_received,
    SUM(invoice_amount - amount_received) AS outstanding_balance,
    SUM(CASE WHEN payment_due_date < CAST(GETDATE() AS date) AND amount_received < invoice_amount THEN 1 ELSE 0 END) AS past_due_open_rows
FROM dbo.Fines
GROUP BY finance_status
ORDER BY finance_status;

SELECT fine_reason, COUNT_BIG(*) AS fine_rows, SUM(fine_amount) AS fine_amount
FROM dbo.Fines
GROUP BY fine_reason
ORDER BY fine_rows DESC;

SELECT
    SUM(CASE WHEN ordered_qty IS NULL THEN 1 ELSE 0 END) AS missing_ordered_qty,
    SUM(CASE WHEN produced_qty IS NULL THEN 1 ELSE 0 END) AS missing_produced_qty,
    SUM(CASE WHEN dispatched_qty IS NULL THEN 1 ELSE 0 END) AS missing_dispatched_qty,
    SUM(CASE WHEN delivered_qty IS NULL THEN 1 ELSE 0 END) AS missing_delivered_qty,
    SUM(CASE WHEN actual_delivery_date IS NULL THEN 1 ELSE 0 END) AS missing_actual_delivery_date,
    SUM(CASE WHEN produced_qty > ordered_qty THEN 1 ELSE 0 END) AS produced_over_ordered_rows,
    SUM(CASE WHEN dispatched_qty > produced_qty THEN 1 ELSE 0 END) AS dispatched_over_produced_rows,
    SUM(CASE WHEN delivered_qty > dispatched_qty THEN 1 ELSE 0 END) AS delivered_over_dispatched_rows
FROM dbo.Fines;

SELECT role, approval_status, is_active, COUNT_BIG(*) AS user_rows
FROM dbo.Users
GROUP BY role, approval_status, is_active
ORDER BY role, approval_status, is_active;

SELECT event_type, COUNT_BIG(*) AS event_rows, MIN(created_at) AS first_event, MAX(created_at) AS last_event
FROM dbo.ActivityEvents
GROUP BY event_type
ORDER BY event_rows DESC;

SELECT
    COUNT_BIG(*) AS event_rows,
    SUM(CASE WHEN a.fine_id IS NOT NULL AND f.fine_id IS NULL THEN 1 ELSE 0 END) AS orphan_fine_events,
    SUM(CASE WHEN u.user_id IS NULL THEN 1 ELSE 0 END) AS orphan_actor_events
FROM dbo.ActivityEvents AS a
LEFT JOIN dbo.Fines AS f ON f.fine_id = a.fine_id
LEFT JOIN dbo.Users AS u ON u.user_id = a.actor_user_id;

SELECT
    CONVERT(char(7), fine_date, 126) AS fine_month,
    COUNT_BIG(*) AS fine_rows,
    SUM(fine_amount) AS fine_amount,
    SUM(invoice_amount) AS invoice_amount,
    SUM(amount_received) AS amount_received
FROM dbo.Fines
GROUP BY CONVERT(char(7), fine_date, 126)
ORDER BY fine_month;
