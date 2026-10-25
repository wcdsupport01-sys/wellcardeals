import { resolveProfileMedia } from "../lib/privateMedia";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { buyerSignInWithGoogle, ensureBuyerProfile } from "./authApi";
import { initialAuthState, startAuthSession } from "./authSession";

const AuthContext = createContext();
export const AuthProvider = ({ children }) => {
  const [state, setState] = useState(initialAuthState);
  const session = useRef(null);
  useEffect(() => {
    const controller = startAuthSession(supabase, setState, ensureBuyerProfile, profile => resolveProfileMedia(supabase, profile, import.meta.env.VITE_SUPABASE_URL));
    session.current = controller;
    const refresh = () => controller.refresh?.();
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      controller.stop();
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return (
    <AuthContext.Provider
      value={{
        ...state,
        loginWithGoogle: buyerSignInWithGoogle,
        signOut: () => session.current?.signOut(),
        retryAuth: () => session.current?.retry(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
export const useAuth = () => useContext(AuthContext);

export function AuthRecovery({ retry }) {
  return (
    <div
      role="alert"
      className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <p>Your account access could not be verified.</p>
      <button
        onClick={retry}
        className="rounded-xl bg-blue-700 px-5 py-3 text-white font-semibold"
      >
        Retry account check
      </button>
    </div>
  );
}
