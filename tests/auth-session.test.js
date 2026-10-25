import test from "node:test";
import assert from "node:assert/strict";
import { startAuthSession } from "../src/auth/authSession.js";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function fixture() {
  let callback;
  const queries = [];
  const states = [];
  let profileEvent;
  const db = {
    auth: {
      onAuthStateChange: (handler) => {
        callback = handler;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      getSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: () => {
      let id;
      const query = {
        select: () => query,
        eq: (_field, value) => {
          id = value;
          return query;
        },
        maybeSingle: () => query,
        abortSignal: () =>
          new Promise((resolve) => queries.push({ id, resolve })),
      };
      return query;
    },
    channel: () => {
      const channel = {
        on: (_event, _filter, handler) => {
          profileEvent = handler;
          return channel;
        },
        subscribe: () => channel,
      };
      return channel;
    },
    removeChannel() {},
  };
  const controller = startAuthSession(
    db,
    (state) => states.push(state),
    async () => {},
  );
  return {
    db,
    queries,
    states,
    controller,
    emit: (session) => callback("SIGNED_IN", session),
    profileEvent: () => profileEvent(),
  };
}
const session = (id) => ({ user: { id } });
const row = (id, role = "buyer", status = "approved") => ({
  data: { id, role, status },
  error: null,
});

test("a slow old profile cannot restore permissions after sign out", async () => {
  const f = fixture();
  try {
    f.emit(session("admin"));
    await flush();
    f.emit(null);
    await flush();
    f.queries[0].resolve(row("admin", "admin"));
    await flush();
    assert.equal(f.states.at(-1).role, null);
    assert.equal(f.states.at(-1).session, null);
  } finally {
    f.controller.stop();
  }
});
test("switching accounts discards the first account response", async () => {
  const f = fixture();
  try {
    f.emit(session("one"));
    await flush();
    f.emit(session("two"));
    await flush();
    f.queries[1].resolve(row("two", "dealer"));
    await flush();
    f.queries[0].resolve(row("one", "admin"));
    await flush();
    assert.equal(f.states.at(-1).user.id, "two");
    assert.equal(f.states.at(-1).role, "dealer");
  } finally {
    f.controller.stop();
  }
});
test("profile errors fail closed and can be retried", async () => {
  const f = fixture();
  try {
    f.emit(session("one"));
    await flush();
    f.queries[0].resolve({ data: null, error: new Error("offline") });
    await flush();
    assert.equal(f.states.at(-1).role, null);
    assert(f.states.at(-1).authError);
    const retry = f.controller.retry();
    await flush();
    f.queries[1].resolve(row("one"));
    await retry;
    assert.equal(f.states.at(-1).role, "buyer");
    assert.equal(f.states.at(-1).authError, null);
  } finally {
    f.controller.stop();
  }
});
test("inactive staff receive no staff role and cannot pass frontend gates", async () => {
  const f = fixture();
  try {
    f.emit(session("one"));
    await flush();
    f.queries[0].resolve(row("one", "admin", "suspended"));
    await flush();
    assert.equal(f.states.at(-1).role, null);
  } finally {
    f.controller.stop();
  }
});
test("a failed second profile read is not treated as an empty successful profile", async () => {
  const f = fixture();
  try {
    f.emit(session("one"));
    await flush();
    f.queries[0].resolve({ data: null, error: null });
    await flush();
    f.queries[1].resolve({ data: null, error: new Error("refetch failed") });
    await flush();
    assert(f.states.at(-1).authError);
    assert.equal(f.states.at(-1).loading, false);
  } finally {
    f.controller.stop();
  }
});
test("disposed subscriptions cannot update the next mounted provider", async () => {
  const f = fixture();
  f.emit(session("one"));
  await flush();
  f.controller.stop();
  const before = f.states.length;
  f.queries[0].resolve(row("one", "admin"));
  await flush();
  assert.equal(f.states.length, before);
});
