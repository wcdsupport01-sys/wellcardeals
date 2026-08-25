import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Building2,
  User,
  MapPin,
  Smartphone,
  Mail,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import AuthCard from "../../auth/AuthCard";
import { submitDealerApplication } from "../../auth/authApi";

// ---------------------------------------------------------------------------
// Dealer Registration — application intake only.
// Submitting this form just saves the application (status = "pending").
// No password is created, no auth account/session is created, and no
// Dealer ID is generated here. The dealer cannot log in yet — that is a
// separate, later step once an admin reviews and approves the application.
// ---------------------------------------------------------------------------

const emptyProfile = {
  business_name: "",
  dealer_name: "",
  business_address: "",
  mobile_number: "",
  email: "",
};

const FIELDS = [
  {
    key: "business_name",
    label: "Business Name",
    placeholder: "e.g. Elite Motors Pvt. Ltd.",
    icon: Building2,
    type: "text",
    span: "md:col-span-2",
  },
  {
    key: "dealer_name",
    label: "Dealer Name",
    placeholder: "Your full name",
    icon: User,
    type: "text",
  },
  {
    key: "mobile_number",
    label: "Mobile Number",
    placeholder: "10-digit mobile number",
    icon: Smartphone,
    type: "tel",
  },
  {
    key: "business_address",
    label: "Business Address",
    placeholder: "Showroom / office address",
    icon: MapPin,
    type: "text",
    span: "md:col-span-2",
  },
  {
    key: "email",
    label: "Email Address",
    placeholder: "you@business.com",
    icon: Mail,
    type: "email",
    span: "md:col-span-2",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

export default function DealerRegister() {
  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [focused, setFocused] = useState(null);
  const navigate = useNavigate();

  function set(field, value) {
    setProfile((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await submitDealerApplication({
        businessName: profile.business_name,
        dealerName: profile.dealer_name,
        businessAddress: profile.business_address,
        mobileNumber: profile.mobile_number,
        email: profile.email,
      });
      setDone(true);
      // Redirect to the home page after a short pause so the person sees
      // the "application submitted" confirmation before leaving the page.
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthCard title="Application submitted" subtitle="">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-2xl border border-[#DCE6FB] bg-gradient-to-br from-white via-[#F6F9FF] to-[#EAF1FF] p-6"
        >
          <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-[#1E4FD9]/10 blur-2xl" />
          <div className="flex items-start gap-3 relative">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 18 }}
              className="shrink-0 rounded-full bg-emerald-100 p-1.5"
            >
              <CheckCircle2 size={22} className="text-emerald-600" />
            </motion.div>
            <p className="text-[#0B1F4D] text-[15px] leading-relaxed">
              Your dealer application is now{" "}
              <span className="text-[#1E4FD9] font-semibold">pending admin approval</span>. We'll
              notify you by email once it's reviewed — dealer login isn't available until then.
            </p>
          </div>
        </motion.div>
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate("/")}
          className="mt-6 w-full rounded-2xl bg-gradient-to-r from-[#1E4FD9] to-[#3B6BF0] hover:brightness-110 text-white font-semibold py-4 text-base shadow-lg shadow-[#1E4FD9]/25 transition"
        >
          Back to home
        </motion.button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Dealer registration"
      subtitle="Your account stays pending until an admin approves it."
      wide
    >
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="mb-5 flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 overflow-hidden"
          >
            <AlertCircle size={16} className="shrink-0" /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium glass panel wrapping the form */}
      <div className="relative">
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#2563EB]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-[#1E4FD9]/8 blur-3xl" />

        <motion.form
          variants={container}
          initial="hidden"
          animate="show"
          onSubmit={handleSubmit}
          className="relative rounded-3xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgba(11,31,77,0.06)] p-5 sm:p-7"
        >
          <motion.div variants={item} className="flex items-center gap-2 mb-6">
            <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-[#1E4FD9]/10">
              <Sparkles size={15} className="text-[#1E4FD9]" />
            </span>
            <p className="text-sm font-medium text-[#4B5C7E]">
              Just the essentials — we'll verify the rest during approval.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FIELDS.map(({ key, label, placeholder, icon: Icon, type, span }) => (
              <motion.div key={key} variants={item} className={`flex flex-col gap-1.5 ${span || ""}`}>
                <label htmlFor={key} className="text-sm font-semibold text-[#0B1F4D] pl-1">
                  {label}
                </label>
                <div
                  className={`group flex items-center gap-3 rounded-2xl bg-white border px-4 py-3.5 transition-all duration-200 ${
                    focused === key
                      ? "border-[#1E4FD9] ring-4 ring-[#1E4FD9]/10 shadow-md"
                      : "border-[#E1E8F5] hover:border-[#C3D3F2]"
                  }`}
                >
                  <Icon
                    size={18}
                    className={`shrink-0 transition-colors ${
                      focused === key ? "text-[#1E4FD9]" : "text-[#93A0BD]"
                    }`}
                  />
                  <input
                    id={key}
                    required
                    type={type}
                    placeholder={placeholder}
                    value={profile[key]}
                    onChange={(e) => set(key, e.target.value)}
                    onFocus={() => setFocused(key)}
                    onBlur={() => setFocused(null)}
                    className="w-full bg-transparent text-[#0B1F4D] placeholder:text-[#A9B4CC] text-base focus:outline-none"
                  />
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div variants={item} className="mt-8">
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="w-full rounded-2xl bg-gradient-to-r from-[#1E4FD9] to-[#3B6BF0] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 text-base flex items-center justify-center gap-2 shadow-lg shadow-[#1E4FD9]/25 hover:shadow-xl hover:shadow-[#1E4FD9]/30 transition-shadow"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  Apply as Dealer <ArrowRight size={18} />
                </>
              )}
            </motion.button>
          </motion.div>
        </motion.form>
      </div>

      <p className="text-sm text-[#6B7A9A] text-center mt-6">
        Already approved?{" "}
        <Link to="/dealer-login" className="text-[#1E4FD9] font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
