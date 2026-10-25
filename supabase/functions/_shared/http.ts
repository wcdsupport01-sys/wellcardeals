export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export class InputError extends Response {
  constructor(message: string, status = 400) {
    super(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

export async function readJson(
  req: Request,
  limit = 128 * 1024,
): Promise<Record<string, any>> {
  if (
    !req.headers.get("content-type")?.toLowerCase().includes("application/json")
  ) throw new InputError("Use application/json.", 415);
  const reader = req.body?.getReader();
  if (!reader) throw new InputError("A JSON object is required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new InputError("Request body is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new InputError("Invalid JSON.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new InputError("A JSON object is required.");
  }
  return data;
}

export function uuid(value: unknown, field = "id"): asserts value is string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) throw new InputError(`${field} must be a UUID.`);
}

export function text(
  value: unknown,
  field: string,
  max = 200,
  required = true,
): string {
  if ((value == null || value === "") && !required) return "";
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new InputError(
      `${field} must be valid text (up to ${max} characters).`,
    );
  }
  return value.trim();
}

export function email(value: unknown): string {
  const normalized = text(value, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new InputError("A valid email is required.");
  }
  return normalized;
}

export function literalLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function activeStaff(
  profile: { role?: string; status?: string } | null,
  allowed: string[],
): boolean {
  return Boolean(
    profile && profile.status === "approved" &&
      allowed.includes(profile.role || ""),
  );
}

export function escapeHtml(value: string): string {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
}
