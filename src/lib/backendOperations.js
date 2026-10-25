// Retain the operation ID across uncertain network replies and page reloads.
// Storage contains only a hash and random ID, never form fields or credentials.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, canonical(value[k])]));
  return value;
}
export function createBackendCommands(db, storage) {
  if (storage === undefined) { try { storage = globalThis.sessionStorage; } catch { storage = null; } }
  const pending = new Map();
  const retained = new Map();
  return async function command(action, payload) {
    const { data: { session }, error: sessionError } = await db.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.user?.id) throw new Error("Sign in before saving.");
    const body = canonical(payload);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(body))))).map(x => x.toString(16).padStart(2, "0")).join("");
    const key = `wcd-operation:${session.user.id}:${action}:${hash}`;
    if (pending.has(key)) return pending.get(key);
    let operationId = retained.get(key);
    try { operationId ||= storage?.getItem(key); } catch { /* Memory survives an unavailable storage API. */ }
    operationId ||= crypto.randomUUID();
    retained.set(key, operationId);
    try { storage?.setItem(key, operationId); } catch { /* Same-page retries still reuse the key. */ }
    const task = (async () => {
      const { data, error } = await db.rpc("backend_car_command", { p_action: action, p_payload: body, p_operation_id: operationId });
      if (error) throw error;
      if (data == null) throw new Error("Save receipt unavailable. Retry to check the original request.");
      retained.delete(key);
      try { storage?.removeItem(key); } catch { /* Not needed once acknowledged. */ }
      return data;
    })();
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  };
}
