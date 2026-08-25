import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import AuthCard, { authInputClass } from "../../auth/AuthCard";
import { buyerSignIn, buyerSignInWithGoogle } from "../../auth/authApi";

export default function BuyerLogin() {
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
      await buyerSignIn({ email, password });
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Buyer Login" subtitle="Sign in to bid on live auctions.">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" required placeholder="Email" className={authInputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" required placeholder="Password" className={authInputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-[#1E4FD9] hover:underline">Forgot password?</Link>
        </div>
        <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#1E4FD9] hover:bg-[#1a41c2] disabled:opacity-60 text-white font-semibold py-3.5 text-base flex items-center justify-center gap-2">
          {loading && <Loader2 size={18} className="animate-spin" />} Sign In
        </button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-[#E7ECF6]" />
        <span className="text-xs text-[#93A0BD]">OR</span>
        <div className="h-px flex-1 bg-[#E7ECF6]" />
      </div>

      <button
        type="button"
        onClick={() =>
          buyerSignInWithGoogle()
            .then(() => navigate(location.state?.from?.pathname || "/", { replace: true }))
            .catch((e) => setError(e.message))
        }
        className="w-full rounded-xl border border-[#E1E8F5] hover:bg-[#F5F8FD] text-[#0B1F4D] py-3.5 text-base font-medium"
      >
        Continue with Google
      </button>

      <p className="text-sm text-[#6B7A9A] text-center mt-6">
        New here? <Link to="/signup" className="text-[#1E4FD9] hover:underline">Create a buyer account</Link>
      </p>
      <p className="text-xs text-[#93A0BD] text-center mt-2">
        Are you a car dealer? <Link to="/dealer-login" className="text-[#6B7A9A] hover:underline">Dealer login</Link>
      </p>
    </AuthCard>
  );
}
