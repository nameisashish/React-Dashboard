import { useEffect, useState } from "react";
import { FineDrawer, ExportModal, ReviewModal } from "./components/FinePanels.jsx";
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
import { can, canAccessPage, homePage } from "./services/permissions.js";
export default function App() {
    const [user, setUser] = useState(null);
    const [authPage, setAuthPage] = useState("login");
    const [authNotice, setAuthNotice] = useState("");
    const [page, setPage] = useState(() => window.location.hash.slice(1) || "dashboard");
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [navFilters, setNavFilters] = useState({});
    const [selected, setSelected] = useState(null);
    const [history, setHistory] = useState([]);
    const [reviewing, setReviewing] = useState(null);
    const [exportState, setExportState] = useState(null);
    const [toast, setToast] = useState(null);
    const navigate = next => { window.location.hash = next; setPage(next); };
    const signedIn = account => { setUser(account); navigate(window.location.hash.slice(1) || homePage(account.role)); };
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
        let active = true;
        if (!selected) {
            setHistory([]);
            return () => {
                active = false;
            };
        }
        setHistory([]);
        finesService.reviews(selected.fineId)
            .then((items) => {
                if (active) setHistory(items);
            })
            .catch(() => {
                if (active) setHistory([]);
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
        setSelected(fine);
        if (review && user && can(user.role, "fine:review"))
            setReviewing(fine);
    };
    const saveReview = async (request) => {
        if (!reviewing)
            return;
        if (!user || !can(user.role, "fine:review"))
            throw new Error("unauthorized");
        const updated = await finesService.review(reviewing.fineId, request, user);
        setRecords((all) => all.map((fine) => (fine.fineId === updated.fineId ? updated : fine)));
        setSelected(updated);
        setReviewing(null);
        setToast({ message: "Fine review saved successfully." });
    };
    const navigateFines = (filters) => {
        setNavFilters(filters);
        navigate("fines");
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
            setUser(null);
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
            setPage("dashboard");
            setSelected(null);
            setReviewing(null);
            setExportState(null);
        }} onNavigate={(next) => {
            navigate(next);
            if (next === "dashboard")
                setNavFilters({});
        }}>
      <div className="workspace-heading"><div><span className="eyebrow red">OPERATIONS / FINANCE</span><p>Fines &amp; Fees · Logistics, warehouse and manufacturing</p></div>{can(user.role, "dataset:import") && <button className="btn btn-secondary" onClick={() => navigate(page === 'import' ? homePage(user.role) : 'import')}>{page === 'import' ? 'Back to summary' : 'Import dataset'}</button>}</div>
      {!canAccessPage(user.role, page) ? <section role="alert" className="import-card"><h1>Access restricted</h1><p>Your role does not have permission to open this page.</p><button className="btn btn-primary" onClick={() => navigate(homePage(user.role))}>Go to my workspace</button></section> : page === 'users' ? <UsersPage/> : page === 'import' ? <ImportPage onImported={refresh}/> : loading && !records.length ? (<LoadingPage />) : page === "dashboard" ? (<><h1 className="page-title">Executive Summary</h1><DashboardPage records={records} onNavigateFines={navigateFines}/></>) : (<><h1 className="page-title">Fines Details</h1><FinesDetailsPage key={JSON.stringify(navFilters)} records={records} role={user.role} initialFilters={navFilters} onOpen={openFine} onRefresh={refresh} onExport={(fines, filters) => setExportState({ records: fines, filters })}/></>)}
      {selected && (<FineDrawer fine={selected} role={user.role} history={history} onClose={() => setSelected(null)} onReview={() => setReviewing(selected)}/>)}
      {reviewing && can(user.role, "fine:review") && (<ReviewModal fine={reviewing} role={user.role} onClose={() => setReviewing(null)} onSave={saveReview}/>)}
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
                reason: exportState.filters.reasons.join(", ") || "All",
                search: exportState.filters.search ?? "",
            }} onClose={() => setExportState(null)} onExport={exportWorkbook}/>)}
      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}
    </Layout>);
}
