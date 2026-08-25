import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Loader2, AlertCircle, ShieldAlert, Home } from "lucide-react";
import { authInputClass } from "../auth/AuthCard";
import { adminSignIn } from "../auth/authApi";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminSignIn({ email, password });
      navigate(location.state?.from?.pathname || "/admin", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
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
          <span className="text-lg font-semibold tracking-tight">Admin Access</span>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" required placeholder="Admin email" className={authInputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" required placeholder="Password" className={authInputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-semibold py-2.5 flex items-center justify-center gap-2">
              {loading && <Loader2 size={18} className="animate-spin" />} Sign In
            </button>
          </form>
          <p className="text-xs text-[#93A0BD] text-center mt-6">
            Admin accounts can only be created directly in Supabase — there is no sign-up here.
          </p>
        </div>
      </div>
    </div>
  );
}
