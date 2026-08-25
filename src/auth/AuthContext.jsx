// src/auth/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { buyerSignInWithGoogle, ensureBuyerProfile } from "./authApi";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); // profiles row (buyer/dealer/admin)
  const [role, setRole] = useState(null);
  const [dealerStatus, setDealerStatus] = useState(null);
  const [dealerAccessCodeVerified, setDealerAccessCodeVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);

  const loginWithGoogle = async () => {
    const data = await buyerSignInWithGoogle();
    return data;
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("SignOut Error:", error.message);
    }
  };

  async function loadProfile(currentUser) {
    if (!currentUser) {
      setProfile(null);
      setRole(null);
      setDealerStatus(null);
      setDealerAccessCodeVerified(false);
      setLoading(false);
      return;
    }

    let { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    // A Google sign-in (or any brand-new user) may not have a profiles row
    // yet — create the default buyer row and re-fetch.
    if (!error && !data) {
      await ensureBuyerProfile(currentUser);
      ({ data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle());
    }

    if (error) {
      console.error("Error loading profile:", error.message);
      setProfile(null);
      setRole(null);
      setDealerStatus(null);
      setDealerAccessCodeVerified(false);
      setLoading(false);
      return;
    }

    setProfile(data || null);
    setRole(data?.role || null);
    setDealerStatus(data?.role === "dealer" ? data?.status || "pending" : null);
    setDealerAccessCodeVerified(data?.role === "dealer" ? Boolean(data?.dealer_access_code_verified) : false);
    setLoading(false);
  }

  function subscribeToProfile(userId) {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (!userId) return;

    // Real-time equivalent of Firestore's onSnapshot: if this row is ever
    // changed (e.g. an admin approves the dealer, or revokes admin access
    // mid-session), the UI updates without needing to sign out first.
    channelRef.current = supabase
      .channel(`profile-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          const data = payload.eventType === "DELETE" ? null : payload.new;
          setProfile(data);
          setRole(data?.role || null);
          setDealerStatus(data?.role === "dealer" ? data?.status || "pending" : null);
          setDealerAccessCodeVerified(data?.role === "dealer" ? Boolean(data?.dealer_access_code_verified) : false);
        }
      )
      .subscribe();
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user || null);
      loadProfile(session?.user || null);
      subscribeToProfile(session?.user?.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setLoading(true);
      loadProfile(session?.user || null);
      subscribeToProfile(session?.user?.id);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session: user,
        profile,
        role,
        dealerStatus,
        dealerAccessCodeVerified,
        loading,
        loginWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
