import { useRef, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Loader2, AlertCircle, ShieldAlert, Home } from "lucide-react";
import { authInputClass } from "../auth/AuthCard";
import { adminSignIn } from "../auth/authApi";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submitLock = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitLock.current) return;

    const identifier = email.trim();

    if (!identifier) {
      setError("Enter your Staff ID or existing login email.");
      return;
    }

    submitLock.current = true;
    setError("");
    setLoading(true);

    try {
      await adminSignIn({ email: identifier, password });
      navigate(location.state?.from?.pathname || "/admin", {
        replace: true,
      });
    } catch (failure) {
      setError(failure.message || "Login failed.");
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4 relative">
      <Link
        to="/"
        className="absolute top-5 left-5 flex items-center gap-1.5 text-xs font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-4 py-2 transition"
      >
        <Home size={14} /> Back to Home
      </Link>

      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <ShieldAlert className="text-amber-400" size={26} />
          <span className="text-lg font-semibold tracking-tight">
            Admin Access
          </span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8">
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5"
            >
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              required
              aria-label="Staff ID or existing login email"
              placeholder="Staff ID or existing login email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              disabled={loading}
              className={authInputClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <input
              type="password"
              required
              aria-label="Password"
              placeholder="Password"
              autoComplete="current-password"
              disabled={loading}
              className={authInputClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-semibold py-2.5 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              Sign In
            </button>
          </form>

          <p className="text-xs text-[#93A0BD] text-center mt-6">
            New staff use their Staff ID and password. Existing accounts
            can continue using their original login email. Contact your
            company admin for a staff account or password reset.
          </p>
        </div>
      </div>
    </div>
  );
}
