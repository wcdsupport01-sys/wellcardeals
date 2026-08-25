const AUTH_EVENT = "open-auth-modal";

export const openAuthModal = (mode = "login") => {
  window.dispatchEvent(
    new CustomEvent(AUTH_EVENT, {
      detail: { mode },
    })
  );
};

export const subscribeAuthModal = (callback) => {
  const handler = (event) => {
    callback(event.detail?.mode || "login");
  };

  window.addEventListener(AUTH_EVENT, handler);

  return () => {
    window.removeEventListener(AUTH_EVENT, handler);
  };
};