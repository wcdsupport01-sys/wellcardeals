import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import AuthCard, { authInputClass } from "../../auth/AuthCard";
import { sendPasswordReset, updatePassword } from "../../auth/authApi";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.message || "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthCard title="Check your email" subtitle="">
        <div className="flex items-center gap-2 text-emerald-600">
          <CheckCircle2 size={20} />
          <span>Password reset link sent to {email}.</span>
        </div>
        <Link to="/login" className="block text-center text-[#1E4FD9] hover:underline mt-6">Back to login</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Forgot Password" subtitle="We'll email you a reset link.">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" required placeholder="Email" className={authInputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#1E4FD9] hover:bg-[#1a41c2] disabled:opacity-60 text-white font-semibold py-3.5 text-base flex items-center justify-center gap-2">
          {loading && <Loader2 size={18} className="animate-spin" />} Send Reset Link
        </button>
      </form>
      <p className="text-sm text-[#6B7A9A] text-center mt-6">
        <Link to="/login" className="text-[#1E4FD9] hover:underline">Back to login</Link>
      </p>
    </AuthCard>
  );
}

export function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (err) {
      setError(err.message || "Could not update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Set a new password" subtitle="You followed the reset link from your email.">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {done ? (
        <div className="flex items-center gap-2 text-emerald-600">
          <CheckCircle2 size={20} /> Password updated — redirecting to login...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="password" required minLength={6} placeholder="New password" className={authInputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#1E4FD9] hover:bg-[#1a41c2] disabled:opacity-60 text-white font-semibold py-3.5 text-base flex items-center justify-center gap-2">
            {loading && <Loader2 size={18} className="animate-spin" />} Update Password
          </button>
        </form>
      )}
    </AuthCard>
  );
}
