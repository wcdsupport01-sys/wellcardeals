const privateBuckets = new Set(["dealer-docs", "sell-requests-media"]);
export function privateObjectPath(value, supabaseUrl) {
  if (typeof value !== "string") return null;
  if (value.startsWith("storage://")) {
    const [bucket, ...parts] = value.slice(10).split("/");
    return privateBuckets.has(bucket) && parts.length ? { bucket, path: parts.join("/") } : null;
  }
  try {
    const url = new URL(value);
    if (url.origin !== new URL(supabaseUrl).origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
    if (match && privateBuckets.has(match[1])) return { bucket: match[1], path: decodeURIComponent(match[2]) };
  } catch { /* Other external images are not Supabase private objects. */ }
  return null;
}
export async function resolveProfileMedia(db, profile, supabaseUrl) {
  const result = { ...profile };
  await Promise.all(["license_url", "profile_image_url", "business_logo_url", "pan_photo_url"].map(async field => {
    const object = privateObjectPath(profile[field], supabaseUrl);
    if (!object) return;
    try {
      const { data, error } = await db.storage.from(object.bucket).createSignedUrl(object.path, 600);
      result[field] = !error && data?.signedUrl ? data.signedUrl : null;
      if (!result[field]) result.mediaError = "Some documents could not be opened. Retry loading this page.";
    } catch { result[field] = null; result.mediaError = "Some documents could not be opened. Retry loading this page."; }
  }));
  return result;
}
