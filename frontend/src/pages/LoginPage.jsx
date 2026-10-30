import { BarChart3, Check, ClipboardCheck, ShieldCheck, } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui.jsx";
import { authService } from "../services/authService.js";
export function LoginPage({ onLogin, onSignUp, notice, }) {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [authError, setAuthError] = useState("");
    const submit = async (event) => {
        event.preventDefault();
        const next = {};
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
            next.email = "Enter a valid work email.";
        setErrors(next);
        if (Object.keys(next).length)
            return;
        setLoading(true);
        setAuthError("");
        try {
            const user = await authService.signIn(email);
            onLogin(user);
        }
        catch (error) {
            const code = error instanceof Error ? error.message : "";
            setAuthError(code === "pending" ? "Your account is awaiting administrator approval. You will be able to sign in after your registration is approved." : code === "rejected" ? "This account has not been approved. Contact your administrator for assistance." : "We could not sign you in with those credentials. Check your details and try again.");
        }
        finally {
            setLoading(false);
        }
    };
    return (<div className="login-page">
      <section className="login-brand">
        <div className="login-brand-top">
          <div className="brand-mark light">M</div>
          <strong>
            MARS <span>| Fines &amp; Fees</span>
          </strong>
        </div>
        <div className="login-copy">
          <span className="eyebrow">FINANCE &amp; OPERATIONS</span>
          <h1>
            Fines &amp; Fees
            <br />
            Management
          </h1>
          <p>
            Monitor customer fines, resolve pending cases, and improve financial
            visibility.
          </p>
          <ul>
            <li>
              <BarChart3 />
              <span>
                <strong>Centralized fine reporting</strong>One consistent view
                of exposure and activity.
              </span>
            </li>
            <li>
              <ClipboardCheck />
              <span>
                <strong>Controlled review workflow</strong>Clear decisions with
                required context.
              </span>
            </li>
            <li>
              <ShieldCheck />
              <span>
                <strong>Traceable review history</strong>A reliable record of
                manual decisions.
              </span>
            </li>
          </ul>
        </div>
        <p className="login-foot">
          Fines & Fees · Operations workspace
        </p>
      </section>
      <main className="login-form-wrap">
        <div className="login-form">
          <div className="mobile-brand">
            MARS <span>| Fines &amp; Fees</span>
          </div>
          <div>
            <span className="eyebrow red">SECURE ACCESS</span>
            <h2>Welcome back</h2>
            <p>Sign in to access your dashboard.</p>
          </div>
          {notice && (<div className="auth-feedback success" role="status">
              <Check size={17}/>
              {notice}
            </div>)}
          {authError && (<div className="auth-feedback error" role="alert">
              {authError}
            </div>)}
          <form onSubmit={submit} noValidate>
            <label className="form-field">
              <span>Work email</span>
              <div>
                <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your work email" aria-invalid={!!errors.email}/>
              </div>
              {errors.email && <small role="alert">{errors.email}</small>}
            </label>
            <Button type="submit" className="full" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
          <p className="auth-switch">
            Don&apos;t have an account?{" "}
            <button onClick={onSignUp}>Sign up</button>
          </p>
          <p className="security-note">
            <ShieldCheck size={15}/>
            Access is controlled by your administrator.
          </p>
        </div>
      </main>
    </div>);
}
