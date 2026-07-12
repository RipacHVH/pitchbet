/** Canonical site origin: explicit override first, then Render's own URL. */
export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.RENDER_EXTERNAL_URL ??
    "http://localhost:3000"
  );
}
