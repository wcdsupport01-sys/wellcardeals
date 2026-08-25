import { useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { openAuthModal } from "../utils/authBus";

// Fires the same Sign Up modal Navbar already listens for (via authBus),
// once per browser tab session, a couple seconds after a guest lands on
// the site. Signed-in users never see it.
const POPUP_SESSION_KEY = "auctionhub_signup_popup_shown";

export default function AutoSignupPopup() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || user) return;
    if (sessionStorage.getItem(POPUP_SESSION_KEY)) return;

    const timer = setTimeout(() => {
      sessionStorage.setItem(POPUP_SESSION_KEY, "1");
      openAuthModal("signup");
    }, 1500);

    return () => clearTimeout(timer);
  }, [loading, user]);

  return null;
}
