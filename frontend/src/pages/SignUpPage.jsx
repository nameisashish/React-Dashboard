import { CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, User, } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui.jsx";
import { authService } from "../services/authService.js";
export function SignUpPage({ onSignIn, }) {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [failure, setFailure] = useState("");
    const [requestedRole, setRequestedRole] = useState("Viewer");
    const [submitted, setSubmitted] = useState(false);
    const submit = async (event) => {
        event.preventDefault();
        const next = {};
        if (!fullName.trim())
            next.fullName = "Enter your full name.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
            next.email = "Enter a valid work email.";
        if (!password)
            next.password = "Create a password.";
        else if (password.length < 8)
            next.password = "Use at least 8 characters.";
        if (!confirmPassword)
            next.confirmPassword = "Confirm your password.";
        else if (password !== confirmPassword)
            next.confirmPassword = "Passwords must match.";
        setErrors(next);
        setFailure("");
        if (Object.keys(next).length)
            return;
        setLoading(true);
        try {
            await authService.register(fullName, email, password, requestedRole);
            setSubmitted(true);
        }
        catch (error) {
            setFailure(error instanceof Error && error.message === "account-exists"
                ? "An account already exists for this email. Sign in or recover your account."
                : "We could not create your account. Please try again.");
        }
        finally {
            setLoading(false);
        }
    };
    return (<main className="signup-page">
      <section className="signup-card">
        {submitted ? <div className="signup-heading"><span className="eyebrow red">REGISTRATION RECEIVED</span><h1>Registration submitted successfully.</h1><p>Your account is awaiting administrator approval. You will be able to sign in once an administrator reviews your request.</p><Button onClick={() => onSignIn("Your account is awaiting administrator approval. You will be able to sign in after your registration is approved.")}>Return to Sign In</Button></div> : <>
        <div className="signup-brand">
          <div className="brand-mark">M</div>
          <strong>
            MARS <span>| Fines &amp; Fees</span>
          </strong>
        </div>
        <div className="signup-heading">
          <span className="eyebrow red">ACCOUNT REGISTRATION</span>
          <h1>Create your account</h1>
          <p>
            Register to access the MARS Fines &amp; Fees Management application.
          </p>
        </div>
        {failure && (<div className="auth-feedback error" role="alert">
            {failure}
          </div>)}
        <form onSubmit={submit} noValidate>
          <AuthField label="Full Name" icon={<User size={18}/>} value={fullName} onChange={setFullName} placeholder="Enter your full name" error={errors.fullName}/>
          <label className="form-field"><span>Account Type</span><div><select value={requestedRole} onChange={e => setRequestedRole(e.target.value)}><option value="Viewer">User</option><option>Super User</option></select></div><em>Your account must be approved by an administrator before you can sign in.</em></label>
          <AuthField label="Work Email" icon={<Mail size={18}/>} type="email" value={email} onChange={setEmail} placeholder="Enter your work email" error={errors.email}/>
          <AuthField label="Password" icon={<LockKeyhole size={18}/>} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="Create a password" error={errors.password} action={<button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>} help="Use at least 8 characters."/>
          <AuthField label="Confirm Password" icon={<LockKeyhole size={18}/>} type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter your password" error={errors.confirmPassword} action={<button type="button" onClick={() => setShowConfirm(!showConfirm)} aria-label={showConfirm
                    ? "Hide confirmed password"
                    : "Show confirmed password"}>
                {showConfirm ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>}/>
          <Button type="submit" className="full" disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </Button>
        </form>
        <p className="auth-switch">
          Already have an account?{" "}
          <button onClick={() => onSignIn()}>Sign in</button>
        </p>
        <p className="security-note">
          <CheckCircle2 size={15}/>
          Requested role is not assigned until an administrator approves your registration.
        </p>
        </>}
      </section>
    </main>);
}
function AuthField({ label, icon, value, onChange, placeholder, error, type = "text", action, help, }) {
    return (<label className="form-field">
      <span>{label}</span>
      <div>
        {icon}
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-invalid={!!error}/>
        {action}
      </div>
      {error ? <small role="alert">{error}</small> : help && <em>{help}</em>}
    </label>);
}
