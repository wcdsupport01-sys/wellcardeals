export const initialAuthState = () => ({
  user: null,
  session: null,
  profile: null,
  role: null,
  dealerStatus: null,
  dealerAccessCodeVerified: false,
  loading: true,
  authError: null,
});

// One owner for async auth work. Results from an older user/session are never
// allowed to restore permissions after logout, account changes or disposal.
export function startAuthSession(db, onState, ensureProfile, resolveProfile = async profile => profile) {
  let active = true,
    generation = 0,
    currentSession = null,
    channel = null,
    controller = null;
  let authEventSeen = false;
  let state = initialAuthState();
  const emit = (patch) => {
    if (active) {
      state = { ...state, ...patch };
      onState(state);
    }
  };
  const clearChannel = () => {
    if (channel) {
      db.removeChannel(channel);
      channel = null;
    }
  };

  async function resolve(session, background = false) {
    if (!active) return;
    currentSession = session;
    const request = ++generation;
    controller?.abort();
    controller = new AbortController();
    const abort = controller;
    clearChannel();
    if (!background || !session?.user)
      emit({
        ...initialAuthState(),
        user: session?.user || null,
        session: session || null,
        loading: Boolean(session?.user),
      });
    if (!session?.user) return;
    const user = session.user;
    try {
      const query = () =>
        db
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle()
          .abortSignal(
            AbortSignal.any([abort.signal, AbortSignal.timeout(12000)]),
          );
      let result = await query();
      if (result.error) throw result.error;
      if (!active || request !== generation) return;
      if (!result.data) {
        await ensureProfile(
          user,
          AbortSignal.any([abort.signal, AbortSignal.timeout(12000)]),
        );
        result = await query();
      }
      if (result.error) throw result.error;
      if (!active || request !== generation) return;
      let profile = result.data;
      if (!profile || profile.id !== user.id)
        throw new Error("Account profile could not be verified.");
      profile = await resolveProfile(profile);
      if (!active || request !== generation) return;
      const usable =
        profile.status === "approved" ||
        (profile.role === "buyer" && profile.status == null) ||
        profile.role === "dealer";
      emit({
        profile,
        role: usable ? profile.role : null,
        dealerStatus:
          profile.role === "dealer" ? profile.status || "pending" : null,
        dealerAccessCodeVerified: Boolean(profile.dealer_access_code_verified),
        loading: false,
        authError: null,
      });
      channel = db
        .channel(`profile-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          () => {
            queueMicrotask(() => resolve(currentSession));
          },
        )
        .subscribe();
    } catch {
      if (active && request === generation)
        emit({
          profile: null,
          role: null,
          dealerStatus: null,
          dealerAccessCodeVerified: false,
          loading: false,
          authError: "Your account access could not be verified. Please retry.",
        });
    }
  }

  if (!db) {
    emit({ loading: false, authError: "Account services are unavailable." });
    return {
      stop() {
        active = false;
      },
      retry() {},
      async signOut() {},
    };
  }
  const { data: listener } = db.auth.onAuthStateChange((_event, session) => {
    authEventSeen = true;
    // Supabase auth callbacks must return before starting other Supabase work.
    // Invalidate pending permissions synchronously, then resolve off the callback.
    generation++;
    controller?.abort();
    currentSession = session;
    emit({
      ...initialAuthState(),
      user: session?.user || null,
      session: session || null,
      loading: Boolean(session?.user),
    });
    queueMicrotask(() => resolve(session));
  });
  Promise.resolve(db.auth.getSession())
    .then(({ data, error }) => {
      if (!active || authEventSeen) return;
      if (error) throw error;
      return resolve(data.session);
    })
    .catch(() => {
      if (active && !authEventSeen)
        emit({
          loading: false,
          authError: "Could not restore your sign-in session. Please retry.",
        });
    });
  const timer = setInterval(() => {
    if (currentSession?.user) resolve(currentSession, true);
  }, 60000);
  return {
    stop() {
      active = false;
      generation++;
      controller?.abort();
      clearInterval(timer);
      clearChannel();
      listener?.subscription?.unsubscribe();
    },
    retry() {
      return resolve(currentSession);
    },
    refresh() {
      return resolve(currentSession, true);
    },
    async signOut() {
      const { error } = await db.auth.signOut();
      if (error) {
        emit({ authError: "Sign out failed. Please retry." });
        throw error;
      }
      return resolve(null);
    },
  };
}
