import type { RequestHandler } from "express";

const WINDOW_MS = 60_000;

function parseLimit(): number {
  const raw = process.env.DEFINE_GLOBAL_RPM?.trim();
  if (raw === undefined || raw === "") return 60;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 60;
  return n;
}

/**
 * 全局限流：整进程内每分钟最多 N 次 `POST /api/define`（含命中人工摘编的请求）。
 * `DEFINE_GLOBAL_RPM=0` 表示不限制。多实例部署时每个进程各算一份，需网关层合并才严格「全局」。
 */
export function createGlobalDefineRateLimit(): RequestHandler {
  let windowIndex = -1;
  let count = 0;

  return (_req, res, next) => {
    const limit = parseLimit();
    if (limit <= 0) {
      next();
      return;
    }

    const wi = Math.floor(Date.now() / WINDOW_MS);
    if (wi !== windowIndex) {
      windowIndex = wi;
      count = 0;
    }

    if (count >= limit) {
      const windowEndSec = (wi + 1) * (WINDOW_MS / 1000);
      const retryAfter = Math.max(1, Math.ceil(windowEndSec - Date.now() / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        ok: false,
        error: "RATE_LIMIT",
        message: `当前访问量较大，请约 ${retryAfter} 秒后再试。`,
      });
      return;
    }

    count += 1;
    next();
  };
}

export const globalDefineRateLimit = createGlobalDefineRateLimit();
