// Apply a real abort signal, not Promise.race (which leaves the request running).
export function timedFetch(input: string | URL | Request, init: RequestInit = {}) {
  const deadline = AbortSignal.timeout(8000);
  return fetch(input, { ...init, signal: init.signal ? AbortSignal.any([init.signal, deadline]) : deadline });
}
