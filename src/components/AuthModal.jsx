import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, User, Eye, EyeOff, Gavel, AlertCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { buyerSignInWithGoogle } from "../auth/authApi";

const AuthModal = ({ isOpen, mode, onClose, onSwitchMode }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const isLogin = mode === "login";
  const navigate = useNavigate();

  // Close on Escape, lock background scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Reset transient UI state whenever the modal reopens or switches mode
  useEffect(() => {
    setSubmitted(false);
    setShowPassword(false);
  }, [isOpen, mode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  // 🔥 Google Sign-In Handler function
  const handleGoogleSignIn = async () => {
    setGoogleError("");
    setGoogleLoading(true);
    try {
      await buyerSignInWithGoogle();
      onClose();
      navigate("/buyer/dashboard", { replace: true });
    } catch (error) {
      setGoogleError(error.message || "Google sign-in failed.");
    } finally {
      setGoogleLoading(false);
    }
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
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-[#0B1F4D]/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-md rounded-3xl bg-gradient-to-br from-gray-900 to-black border border-white/10 overflow-hidden shadow-2xl"
          >
            {/* Glow accents */}
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 px-8 py-9">
              {/* Close */}
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute top-5 right-5 text-gray-400 hover:text-white transition"
              >
                <X size={20} />
              </button>

              {/* Brand mark */}
              <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mb-6">
                <Gavel size={20} className="text-white" />
              </div>

              {submitted ? (
                <div className="py-6 text-center">
                  <h3 className="text-xl font-semibold text-white">
                    {isLogin ? "Welcome back" : "Account created"}
                  </h3>
                  <p className="text-gray-400 text-sm mt-2">
                    {isLogin
                      ? "You're signed in. This is a design preview, so nothing is stored yet."
                      : "You're all set. This is a design preview, so nothing is stored yet."}
                  </p>
                  <button
                    onClick={onClose}
                    className="mt-6 bg-white text-[#0B1F4D] px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-2xl font-bold text-white tracking-tight">
                    {isLogin ? "Log in to your account" : "Create your account"}
                  </h3>
                  <p className="text-gray-400 text-sm mt-2">
                    {isLogin
                      ? "Access verified auctions and place live bids."
                      : "Join the private dealer network in a few seconds."}
                  </p>

                  <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                    {!isLogin && (
                      <div className="relative">
                        <User
                          size={17}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Full name"
                          className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/60 focus:border-transparent transition"
                        />
                      </div>
                    )}

                    <div className="relative">
                      <Mail
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                      />
                      <input
                        type="email"
                        required
                        placeholder="Email address"
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/60 focus:border-transparent transition"
                      />
                    </div>

                    <div className="relative">
                      <Lock
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                      />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        placeholder="Password"
                        className="w-full pl-11 pr-11 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/60 focus:border-transparent transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>

                    {isLogin && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className="text-xs text-gray-400 hover:text-white transition"
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-white text-[#0B1F4D] py-3 rounded-xl text-sm font-semibold hover:bg-gray-200 transition shadow-lg"
                    >
                      {isLogin ? "Log In" : "Sign Up"}
                    </button>

                    {/* 🔥 ---------------- GOOGLE BUTTON START ---------------- 🔥 */}
                    <div className="relative my-5 flex items-center justify-center">
                      <div className="border-t border-white/10 w-full"></div>
                      <span className="absolute bg-[#12131a] px-3 text-[10px] text-gray-500 uppercase tracking-widest font-medium">
                        or
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={googleLoading}
                      className="w-full bg-white/5 border border-white/10 text-white py-3 rounded-xl text-sm font-semibold hover:bg-white/10 disabled:opacity-60 transition flex items-center justify-center gap-3 shadow-lg"
                    >
                      {googleLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <img
                          src="https://www.svgrepo.com/show/355037/google.svg"
                          className="w-4 h-4"
                          alt="Google Icon"
                        />
                      )}
                      Continue with Google
                    </button>
                    {googleError && (
                      <div className="flex items-center gap-2 text-red-400 text-xs mt-3">
                        <AlertCircle size={14} /> {googleError}
                      </div>
                    )}
                    {/* 🔥 ----------------- GOOGLE BUTTON END ----------------- 🔥 */}

                  </form>

                  <p className="text-center text-sm text-gray-400 mt-6">
                    {isLogin ? "New to AuctionHub?" : "Already have an account?"}{" "}
                    <button
                      onClick={() => onSwitchMode(isLogin ? "signup" : "login")}
                      className="text-white font-medium hover:underline underline-offset-4"
                    >
                      {isLogin ? "Sign up" : "Log in"}
                    </button>
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AuthModal;