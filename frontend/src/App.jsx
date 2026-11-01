import { useEffect, useState } from "react";
import { FineDrawer, ExportModal, ReviewModal } from "./components/FinePanels.jsx";
import { FineRequestModal } from "./components/FineRequestModal.jsx";
import { Layout } from "./components/Layout.jsx";
import { LoadingPage, Toast } from "./components/ui.jsx";
import { finesService } from "./services/finesService.js";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { FinesDetailsPage } from "./pages/FinesDetailsPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { SignUpPage } from "./pages/SignUpPage.jsx";
import { shortDate } from "./utils/fines.js";
import { authService } from "./services/authService.js";
import { ImportPage } from "./pages/ImportPage.jsx";
import { UsersPage } from "./pages/UsersPage.jsx";
import { ActivityPage } from "./pages/ActivityPage.jsx";
import { can, canAccessPage, canReviewFine, homePage } from "./services/permissions.js";
const AUTO_REFRESH_MS = 30_000;

export default function App() {
    const [user, setUser] = useState(null);
    const [authPage, setAuthPage] = useState("login");
    const [authNotice, setAuthNotice] = useState("");
    const [page, setPage] = useState(() => window.location.hash.slice(1) || "dashboard");
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState(null);
    const [overviewLoading, setOverviewLoading] = useState(false);
    const [overviewError, setOverviewError] = useState("");
    const [filters, setFilters] = useState({ reasons: [] });
    const [activityFilters, setActivityFilters] = useState({ eventType: "", fineId: "" });
    const [selected, setSelected] = useState(null);
    const [historyError, setHistoryError] = useState("");
    const [history, setHistory] = useState([]);
    const [reviewing, setReviewing] = useState(null);
    const [exportState, setExportState] = useState(null);
    const [requestingFine, setRequestingFine] = useState(false);
    const [toast, setToast] = useState(null);
    const navigate = next => { window.location.hash = next; setPage(next); };
    const signedIn = account => { setAuthNotice(""); setUser(account); navigate(window.location.hash.slice(1) || homePage(account.role)); };
    useEffect(() => {
        const syncPage = () => { setPage(window.location.hash.slice(1) || "dashboard"); setSelected(null); setReviewing(null); setExportState(null); };
        window.addEventListener('hashchange', syncPage);
        return () => window.removeEventListener('hashchange', syncPage);
    }, []);
    useEffect(() => {
        const expired = () => { setUser(null); setRecords([]); setSelected(null); setReviewing(null); setExportState(null); setAuthNotice("Your session expired. Please sign in again."); };
        window.addEventListener('session-expired', expired);
        if (sessionStorage.getItem('fines-token')) authService.me().then(setUser).catch(expired);
        return () => window.removeEventListener('session-expired', expired);
    }, []);
    useEffect(() => {
        if (!user) return;
        let active = true;
        setLoading(true);
        finesService.list()
            .then((data) => {
                if (!active) return;
                setRecords(data);
                setLoading(false);
            })
            .catch(() => {
                if (!active) return;
                setRecords([]);
                setLoading(false);
                setToast({
                    message: "Unable to load fine records. Please try again.",
                    type: "error",
                });
            });
        return () => {
            active = false;
        };
    }, [user]);
    useEffect(() => {
        if (!user || user.role === "Viewer") {
            setOverview(null);
            setOverviewLoading(false);
            setOverviewError("");
            return;
        }
        let active = true;
        setOverviewLoading(true);
        setOverviewError("");
        finesService.summary().then(data => { if (active) setOverview(data); })
            .catch(error => { if (active) setOverviewError(error.message || "Overview unavailable."); })
            .finally(() => { if (active) setOverviewLoading(false); });
        return () => { active = false; };
    }, [user]);
    useEffect(() => {
        if (!user) return;
        let active = true;
        let inFlight = false;
        const syncServerData = async () => {
            if (inFlight || document.visibilityState === "hidden") return;
            inFlight = true;
            try {
                const latestRecords = await finesService.refresh();
                if (active) setRecords(current => JSON.stringify(current) === JSON.stringify(latestRecords) ? current : latestRecords);
            } catch {
                // Keep the last successful snapshot if the server is temporarily unavailable.
            }
            if (user.role !== "Viewer") {
                try {
                    const latestOverview = await finesService.summary();
                    if (active) {
                        setOverview(current => JSON.stringify(current) === JSON.stringify(latestOverview) ? current : latestOverview);
                        setOverviewError("");
                    }
                } catch (error) {
                    if (active) setOverviewError(error.message || "Overview unavailable.");
                }
            }
            inFlight = false;
        };
        const timer = window.setInterval(syncServerData, AUTO_REFRESH_MS);
        const onVisibilityChange = () => { if (document.visibilityState === "visible") syncServerData(); };
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            active = false;
            inFlight = false;
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [user]);
    useEffect(() => {
        let active = true;
        if (!selected) {
            setHistory([]);
            return () => {
                active = false;
            };
        }
        setHistory([]);
        setHistoryError("");
        finesService.reviews(selected.fineId)
            .then((items) => {
                if (active) setHistory(items);
            })
            .catch(() => {
                if (active) setHistoryError("Review history could not be loaded. Close and reopen this record to retry.");
            });
        return () => {
            active = false;
        };
    }, [selected]);
    useEffect(() => {
        if (!toast)
            return;
        const timer = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(timer);
    }, [toast]);
    const refresh = async () => {
        setLoading(true);
        try {
            const data = await finesService.refresh();
            setRecords(data);
            if (user?.role !== "Viewer") {
                try {
                    setOverview(await finesService.summary());
                    setOverviewError("");
                } catch (error) {
                    setOverviewError(error.message || "Overview unavailable.");
                }
            }
            setToast({ message: "Records refreshed from the server." });
        }
        catch {
            setToast({
                message: "Unable to load fine records. Check your connection and try again.",
                type: "error",
            });
        }
        finally {
            setLoading(false);
        }
    };
    const openFine = (fine, review = false) => {
        if (review) {
            if (user && canReviewFine(user.role, fine.status))
                setReviewing(fine);
            return;
        }
        setSelected(fine);
    };
    const saveReview = async (request) => {
        if (!reviewing)
            return;
        if (!user || !canReviewFine(user.role, reviewing.status))
            throw new Error("unauthorized");
        const updated = await finesService.review(reviewing.fineId, request, user);
        setRecords((all) => all.map((fine) => (fine.fineId === updated.fineId ? updated : fine)));
        setSelected(updated);
        setReviewing(null);
        setToast({ message: "Fine review saved successfully." });
    };
    const submitFineRequest = async (request) => {
        await finesService.createRequest(request);
        setRequestingFine(false);
        await refresh();
        setToast({ message: "Fine request submitted as Pending for Super User review." });
    };
    const navigateFines = (filters) => {
        setFilters(current => ({ ...current, ...filters }));
        navigate("fines");
    };
    const clearAllFilters = () => {
        setFilters({ reasons: [] });
        setActivityFilters({ eventType: "", fineId: "" });
    };
    const exportWorkbook = async () => {
        if (!exportState || !can(user?.role, "fine:export"))
            return;
        const rows = exportState.records;
        const blob = await finesService.export(rows.map(f => f.fineId));
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `fines_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
        link.click(); URL.revokeObjectURL(url);
        setExportState(null);
        setToast({ message: `${rows.length} fine records exported successfully.` });
    };
    if (!user)
        if (authPage === "signup")
            return (<SignUpPage onSignIn={(message) => {
                    setAuthNotice(message ?? "");
                    setAuthPage("login");
                }}/>);
        else
            return (<LoginPage notice={authNotice} onSignUp={() => {
                    setAuthNotice("");
                    setAuthPage("signup");
                }} onLogin={signedIn}/>);
    return (<Layout page={page} user={user} onLogout={async () => {
            try { await authService.logout(); } catch { /* Local session is cleared even if the server is unavailable. */ }
            setRecords([]);
            clearAllFilters();
            setOverview(null);
            setUser(null);
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
            setPage("dashboard");
            setSelected(null);
            setReviewing(null);
            setExportState(null);
        }} onNavigate={(next) => {
            navigate(next);
        }}>
      <div className="workspace-heading"><div><span className="eyebrow red">OPERATIONS / FINANCE</span><p>Fines &amp; Fees · Logistics, warehouse and manufacturing</p></div>{can(user.role, "dataset:import") && <button className="btn btn-secondary" onClick={() => navigate(page === 'import' ? homePage(user.role) : 'import')}>{page === 'import' ? 'Back to summary' : 'Import dataset'}</button>}</div>
      {!canAccessPage(user.role, page) ? <section role="alert" className="import-card"><h1>Access restricted</h1><p>Your role does not have permission to open this page.</p><button className="btn btn-primary" onClick={() => navigate(homePage(user.role))}>Go to my workspace</button></section> : page === 'users' ? <UsersPage/> : page === 'activity' ? <ActivityPage filters={activityFilters} onApplyFilters={setActivityFilters} onClearAllFilters={clearAllFilters}/> : page === 'import' ? <ImportPage onImported={refresh}/> : loading && !records.length ? (<LoadingPage />) : page === "dashboard" ? (<><h1 className="page-title">Executive Summary</h1><DashboardPage records={records} role={user.role} filters={filters} onApplyFilters={setFilters} onClearAllFilters={clearAllFilters} onNavigate={navigate} onNavigateFines={navigateFines} overview={overview} overviewLoading={overviewLoading} overviewError={overviewError}/></>) : (<><h1 className="page-title">Fines Details</h1><FinesDetailsPage records={records} role={user.role} filters={filters} onApplyFilters={setFilters} onClearAllFilters={clearAllFilters} onOpen={openFine} onRequest={() => setRequestingFine(true)} onExport={(fines, filters) => setExportState({ records: fines, filters })}/></>)}
      {selected && (<FineDrawer fine={selected} role={user.role} history={history} historyError={historyError} onClose={() => setSelected(null)} onReview={() => setReviewing(selected)}/>)}
      {reviewing && canReviewFine(user.role, reviewing.status) && (<ReviewModal fine={reviewing} role={user.role} onClose={() => setReviewing(null)} onSave={saveReview}/>)}
      {requestingFine && user.role === "Viewer" && <FineRequestModal onClose={() => setRequestingFine(false)} onSubmit={submitFineRequest}/>}
      {exportState && can(user.role, "fine:export") && (<ExportModal count={exportState.records.length} filters={{
                date: exportState.filters.fromDate || exportState.filters.toDate
                    ? `${exportState.filters.fromDate
                        ? shortDate(exportState.filters.fromDate)
                        : "Any"} – ${exportState.filters.toDate
                        ? shortDate(exportState.filters.toDate)
                        : "Any"}`
                    : "All dates",
                status: exportState.filters.status ?? "All",
                customer: exportState.filters.customerId ?? "All",
                area: exportState.filters.sourceArea || "All",
                reason: exportState.filters.reasons.join(", ") || "All",
            }} onClose={() => setExportState(null)} onExport={exportWorkbook}/>)}
      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}
    </Layout>);
}
