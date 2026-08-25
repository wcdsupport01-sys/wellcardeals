import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import AuthCard, { authInputClass } from "../../auth/AuthCard";
import { buyerSignUp } from "../../auth/authApi";

export default function BuyerSignup() {
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await buyerSignUp({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone,
      });
      if (res.session) {
        navigate("/", { replace: true });
      } else {
        setDone(true); // email confirmation required
      }
    } catch (err) {
      setError(err.message || "Could not create account.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthCard title="Check your email" subtitle="">
        <div className="flex items-center gap-2 text-emerald-600">
          <CheckCircle2 size={20} />
          <span>We sent a confirmation link to {form.email}. Confirm it, then log in.</span>
        </div>
        <Link to="/login" className="block text-center text-[#1E4FD9] hover:underline mt-6">
          Back to login
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create Buyer Account" subtitle="Bid on live vehicle auctions.">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input required placeholder="Full name" className={authInputClass} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
        <input placeholder="Phone number" className={authInputClass} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        <input type="email" required placeholder="Email" className={authInputClass} value={form.email} onChange={(e) => set("email", e.target.value)} />
        <input type="password" required minLength={6} placeholder="Password (min 6 characters)" className={authInputClass} value={form.password} onChange={(e) => set("password", e.target.value)} />
        <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#1E4FD9] hover:bg-[#1a41c2] disabled:opacity-60 text-white font-semibold py-3.5 text-base flex items-center justify-center gap-2">
          {loading && <Loader2 size={18} className="animate-spin" />} Create Account
        </button>
      </form>
      <p className="text-sm text-[#6B7A9A] text-center mt-6">
        Already have an account? <Link to="/login" className="text-[#1E4FD9] hover:underline">Sign in</Link>
      </p>
    </AuthCard>
  );
}
