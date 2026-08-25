import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Clock, Home } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";

export default function DealerPending() {
  const { dealerStatus, role, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (role === "dealer" && dealerStatus === "approved") {
      navigate("/", { replace: true });
    }
  }, [role, dealerStatus, navigate]);

  const messages = {
    pending: "Your dealer application is still under review by our admin team.",
    rejected: "Your dealer application was rejected. Contact support for details.",
    suspended: "Your dealer account has been suspended.",
  };

  async function handleSignOut() {
    await signOut();
    navigate("/dealer-login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4 text-center">
      <div className="max-w-md">
        <Clock className="text-[#7FB4EE] mx-auto mb-4" size={40} />
        <h1 className="text-2xl font-bold mb-2">
          {dealerStatus === "pending" ? "Application Pending" : "Access Restricted"}
        </h1>
        <p className="text-zinc-400 mb-8">{messages[dealerStatus] || messages.pending}</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={handleSignOut} className="rounded-xl border border-white/15 hover:bg-white/5 px-6 py-2.5">
            Sign out
          </button>
          <Link to="/" className="flex items-center gap-1.5 rounded-xl border border-white/15 hover:bg-white/5 px-6 py-2.5 text-sm">
            <Home size={16} /> Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
