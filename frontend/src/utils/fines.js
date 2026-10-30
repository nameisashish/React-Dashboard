export const money = (value, currency = "USD") => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
}).format(value);
export const exactMoney = (value, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
export const shortDate = (value) => new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
}).format(new Date(value));
export const dateTime = (value) => new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
}).format(new Date(value));
export function filterFines(records, filters) {
    const query = filters.search?.trim().toLowerCase();
    return records.filter((fine) => {
        if (filters.fromDate && fine.fineDate.slice(0, 10) < filters.fromDate)
            return false;
        if (filters.toDate && fine.fineDate.slice(0, 10) > filters.toDate)
            return false;
        if (filters.sourceArea && fine.sourceArea !== filters.sourceArea) return false;
        if (filters.status && fine.status !== filters.status)
            return false;
        if (filters.customerId && fine.customerId !== filters.customerId)
            return false;
        if (filters.reasons.length &&
            !filters.reasons.includes(fine.reasonCategory))
            return false;
        return (!query ||
            [
                fine.fineId,
                fine.customerId,
                fine.customerName,
                fine.orderReference,
            ].some((v) => v.toLowerCase().includes(query)));
    });
}
export const aggregateStatuses = (records) => ["Valid", "Invalid", "Pending"].map((status) => ({
    status,
    count: records.filter((f) => f.status === status).length,
    amount: records
        .filter((f) => f.status === status)
        .reduce((sum, f) => sum + f.fineAmount, 0),
}));
export const aggregateReasons = (records) => Array.from(new Set(records.map((f) => f.reasonCategory)))
    .map((reason) => ({
    reason,
    count: records.filter((f) => f.reasonCategory === reason).length,
    amount: records
        .filter((f) => f.reasonCategory === reason)
        .reduce((sum, f) => sum + f.fineAmount, 0),
}))
    .sort((a, b) => b.amount - a.amount);
export function aggregateMonths(records) {
    const map = new Map();
    records.forEach((fine) => {
        const date = new Date(fine.fineDate);
        const sort = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const row = map.get(sort) ?? {
            month: date.toLocaleDateString("en-US", {
                month: "short",
                year: "2-digit",
            }),
            count: 0,
            amount: 0,
            sort,
        };
        row.count++;
        row.amount += fine.fineAmount;
        map.set(sort, row);
    });
    return [...map.values()].sort((a, b) => a.sort.localeCompare(b.sort));
}
export const last12Months = () => {
    const to = new Date();
    const from = new Date();
    from.setFullYear(from.getFullYear() - 1);
    return {
        fromDate: from.toISOString().slice(0, 10),
        toDate: to.toISOString().slice(0, 10),
    };
};
