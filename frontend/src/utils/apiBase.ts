/** 生产构建时在 Cloudflare Pages 设置 `VITE_API_BASE_URL`（Railway API 根，无尾斜杠）；本地留空走 Vite 代理。 */
export function apiUrl(path: string): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const base =
    typeof raw === "string" && raw.trim().length > 0 ? raw.trim().replace(/\/$/, "") : "";
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
