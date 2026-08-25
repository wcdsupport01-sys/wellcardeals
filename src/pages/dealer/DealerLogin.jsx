import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Loader2, AlertCircle, Clock, XCircle, Home, IdCard } from "lucide-react";
import AuthCard, { authInputClass } from "../../auth/AuthCard";
import { dealerSignInWithIdentifier } from "../../auth/authApi";

// PHASE 6 — Dealer ID + Password login.
// Email/password login has been removed as the primary path: the single
// "identifier" field accepts a Dealer ID (e.g. DLR-000123) once approved.
// Applicants who haven't been approved yet don't have a Dealer ID, so the
// same field also accepts the email they registered with — used only to
// show them their application status (Pending / Rejected), never to log in.
export default function DealerLogin() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusScreen, setStatusScreen] = useState(null); // "pending" | "rejected" | null
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setStatusScreen(null);
    setLoading(true);
    try {
      await dealerSignInWithIdentifier({ identifier, password });
      navigate(location.state?.from?.pathname || "/dealer/dashboard", { replace: true });
    } catch (err) {
      const msg = err.message || "Login failed.";
      if (msg.toLowerCase().includes("under review")) {
        setStatusScreen("pending");
      } else if (msg.toLowerCase().includes("rejected")) {
        setStatusScreen("rejected");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  if (statusScreen === "pending") {
    return (
      <AuthCard title="Application Under Review" subtitle="">
        <div className="flex flex-col items-center text-center gap-3 py-4">
          <Clock size={40} className="text-amber-500" />
          <p className="text-sm text-[#6B7A9A]">
            Your dealer application is still being reviewed by our team. You'll get an email with your
            Dealer ID and login details as soon as it's approved.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setStatusScreen(null);
            setError("");
          }}
          className="w-full rounded-xl bg-[#1E4FD9] hover:bg-[#1a41c2] text-white font-semibold py-3.5 text-base mt-2"
        >
          Back to login
        </button>
      </AuthCard>
    );
  }

  if (statusScreen === "rejected") {
    return (
      <AuthCard title="Application Rejected" subtitle="">
        <div className="flex flex-col items-center text-center gap-3 py-4">
          <XCircle size={40} className="text-red-500" />
          <p className="text-sm text-[#6B7A9A]">
            Unfortunately your dealer application wasn't approved. Contact our support team if you'd
            like more details or to reapply.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setStatusScreen(null);
            setError("");
          }}
          className="w-full rounded-xl bg-[#1E4FD9] hover:bg-[#1a41c2] text-white font-semibold py-3.5 text-base mt-2"
        >
          Back to login
        </button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Dealer Login" subtitle="Access your dealer inventory and auctions.">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <IdCard size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#93A0BD]" />
          <input
            type="text"
            required
            autoCapitalize="characters"
            placeholder="Dealer ID (e.g. DLR-000123)"
            className={`${authInputClass} pl-10`}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>
        <input
          type="password"
          required
          placeholder="Password"
          className={authInputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[#1E4FD9] hover:bg-[#1a41c2] disabled:opacity-60 text-white font-semibold py-3.5 text-base flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={18} className="animate-spin" />} Sign In
        </button>
      </form>
      <p className="text-xs text-[#93A0BD] text-center mt-3">
        Not approved yet? Enter the email you registered with to check your application status.
      </p>
      <p className="text-xs text-[#93A0BD] text-center mt-2">
        Trouble signing in with your password? Dealers can't reset their own password — contact
        your admin or manager and they'll issue you a new one.
      </p>
      <p className="text-sm text-[#6B7A9A] text-center mt-6">
        New dealer? <Link to="/dealer-register" className="text-[#1E4FD9] hover:underline">Register your dealership</Link>
      </p>
      <p className="text-xs text-[#93A0BD] text-center mt-2 flex items-center justify-center gap-3">
        <Link to="/" className="flex items-center gap-1 hover:underline">
          <Home size={12} /> Back to Home
        </Link>
      </p>
    </AuthCard>
  );
}
