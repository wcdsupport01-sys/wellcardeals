import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Loader2, AlertCircle, ShieldCheck, MessageCircle, Home } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { verifyDealerAccessCode } from "../../auth/authApi";

export default function DealerVerifyCode() {
  const { dealerStatus, dealerAccessCodeVerified, role, signOut, profile } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (role === "dealer" && dealerStatus === "approved" && dealerAccessCodeVerified) {
      navigate("/", { replace: true });
    }
  }, [role, dealerStatus, dealerAccessCodeVerified, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!code.trim()) return;
    setLoading(true);
    try {
      const ok = await verifyDealerAccessCode(code.trim());
      if (ok) {
        navigate("/", { replace: true });
      } else {
        setError("Incorrect code. Please check the SMS/WhatsApp message and try again.");
      }
    } catch (err) {
      setError(err.message || "Couldn't verify the code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate("/dealer-login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <MessageCircle className="text-[#7FB4EE] mx-auto mb-4" size={40} />
        <h1 className="text-2xl font-bold mb-2">Enter your access code</h1>
        <p className="text-zinc-400 mb-1">
          Your dealer account for{" "}
          <span className="text-white font-medium">{profile?.business_name || "your business"}</span>{" "}
          has been approved.
        </p>
        <p className="text-zinc-500 text-sm mb-8">
          We've sent a 6-digit access code by SMS/WhatsApp from{" "}
          <span className="text-[#7FB4EE]">+91 9540102163</span>. Enter it below to start bidding in
          live auctions.
        </p>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-2.5 text-left">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            placeholder="6-digit code"
            className="w-full text-center tracking-[0.5em] text-xl font-semibold rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 outline-none px-4 py-3"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
          />
          <button
            type="submit"
            disabled={loading || code.length < 4}
            className="w-full rounded-xl bg-[#1E6FD9] hover:bg-[#1E6FD9] disabled:opacity-60 text-[#0B2545] font-semibold py-2.5 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            Verify &amp; Continue
          </button>
        </form>

        <p className="text-xs text-zinc-600 mt-6">
          Didn't get a code, or it expired? Contact the admin team to resend it.
        </p>
        <div className="flex items-center justify-center gap-4 mt-4">
          <button onClick={handleSignOut} className="text-sm text-zinc-500 hover:text-white underline">
            Sign out
          </button>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white underline">
            <Home size={14} /> Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
