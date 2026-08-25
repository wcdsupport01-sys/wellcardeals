import React from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gavel, Building2, ArrowRight } from "lucide-react";

/**
 * Shown when the user clicks "Log In" / "Sign Up" anywhere on the public site.
 * Lets them pick which portal they want (Buyer or Dealer/Seller), then
 * routes them straight to the real login/signup page for that role.
 */
const RoleSelectModal = ({ isOpen, mode, onClose }) => {
  const navigate = useNavigate();
  const isLogin = mode === "login";

  if (!isOpen) return null;

  const roles = [
    {
      key: "buyer",
      title: "Buyer / Seller",
      desc: "Browse listings, sell your car and bid in live auctions.",
      icon: Gavel,
      loginPath: "/login",
      signupPath: "/signup",
    },
    {
      key: "dealer",
      title: "Dealer",
      desc: "Bid on listed vehicles and grow your inventory.",
      icon: Building2,
      loginPath: "/dealer-login",
      signupPath: "/dealer-register",
    },
  ];

  const handleSelect = (role) => {
    onClose?.();
    navigate(isLogin ? role.loginPath : role.signupPath);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-[#0B1F4D]/40 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-md rounded-3xl bg-white border border-[#E7ECF6] overflow-hidden shadow-2xl shadow-[#0B1F4D]/10"
          >
            <div className="relative z-10 px-8 py-9">
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute top-5 right-5 text-[#93A0BD] hover:text-[#0B1F4D] transition"
              >
                <X size={20} />
              </button>

              <h3 className="text-2xl font-bold text-[#0B1F4D] tracking-tight">
                {isLogin ? "Log in as..." : "Sign up as..."}
              </h3>
              <p className="text-[#6B7A9A] text-sm mt-2">
                Choose how you want to use Well Car Deal.
              </p>

              <div className="mt-7 space-y-3">
                {roles.map((role) => {
                  const Icon = role.icon;
                  return (
                    <button
                      key={role.key}
                      onClick={() => handleSelect(role)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#F5F8FD] border border-[#E1E8F5] hover:border-[#1E4FD9]/40 hover:bg-[#EAF0FB] transition text-left group"
                    >
                      <div className="w-11 h-11 shrink-0 rounded-xl bg-white border border-[#E1E8F5] flex items-center justify-center">
                        <Icon size={19} className="text-[#1E4FD9]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[#0B1F4D] font-semibold text-sm">{role.title}</p>
                        <p className="text-[#6B7A9A] text-xs mt-0.5">{role.desc}</p>
                      </div>
                      <ArrowRight
                        size={16}
                        className="text-[#93A0BD] group-hover:text-[#1E4FD9] group-hover:translate-x-0.5 transition"
                      />
                    </button>
                  );
                })}
              </div>

              <p className="text-center text-sm text-[#6B7A9A] mt-7">
                {isLogin ? "New to Well Car Deal?" : "Already have an account?"}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RoleSelectModal;
