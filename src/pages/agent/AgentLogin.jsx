import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Loader2, AlertCircle, Wrench, Home } from "lucide-react";
import { agentSignIn } from "../../auth/authApi";

const darkInputClass =
  "w-full rounded-xl bg-zinc-900/70 border border-white/10 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition";

export default function AgentLogin() {
  const [agentCode, setAgentCode] = useState("");
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
      await agentSignIn({ agentCode, password });
      navigate(location.state?.from?.pathname || "/agent/dashboard", { replace: true });
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
          <Wrench className="text-emerald-400" size={26} />
          <span className="text-lg font-semibold tracking-tight">Agent Login</span>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              required
              autoFocus
              placeholder="Agent ID (e.g. AGT-4821)"
              className={darkInputClass}
              value={agentCode}
              onChange={(e) => setAgentCode(e.target.value)}
            />
            <input
              type="password"
              required
              placeholder="Password"
              className={darkInputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black font-semibold py-2.5 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />} Sign In
            </button>
          </form>
          <p className="text-xs text-zinc-500 text-center mt-6">
            Agent accounts are created by admin only. Don't have an ID/password? Ask admin.
          </p>
        </div>
      </div>
    </div>
  );
}
