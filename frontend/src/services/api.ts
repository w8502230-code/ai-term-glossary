import type { TDefineResponse } from "../types/api";
import type { THomeStatsResponse, TStatsErrorResponse, TTermStatsResponse } from "../types/stats";
import { apiUrl } from "../utils/apiBase";

export async function defineTerm(term: string): Promise<TDefineResponse> {
  let res: Response;
  try {
    res = await fetch(apiUrl("/api/define"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term }),
    });
  } catch {
    return {
      ok: false,
      error: "NETWORK",
      message:
        "无法连接后端（网络异常或浏览器跨域拦截）。若当前网址是 Cloudflare Pages 的预览链接（子域名为随机字符），请在 Railway 为后端增加环境变量 CORS_PAGES_PROJECT_HOST=你的站点主域（如 xxx.pages.dev，不要写 https://），保存后重新部署后端。",
    };
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as TDefineResponse;
  } catch {
    return {
      ok: false,
      error: "BAD_RESPONSE",
      message: `服务返回异常（HTTP ${res.status}），请稍后重试。`,
    };
  }
}

export async function fetchHomeStats(): Promise<THomeStatsResponse | TStatsErrorResponse> {
  const res = await fetch(apiUrl("/api/stats?scope=home"));
  return (await res.json()) as THomeStatsResponse | TStatsErrorResponse;
}

export async function fetchTermStats(term: string): Promise<TTermStatsResponse | TStatsErrorResponse> {
  const res = await fetch(apiUrl(`/api/stats?term=${encodeURIComponent(term)}`));
  return (await res.json()) as TTermStatsResponse | TStatsErrorResponse;
}

export async function postStatsEvent(payload: {
  kind: "view" | "share" | "like";
  /** view：首页传 scope=home；解释页传 term */
  scope?: "home";
  term?: string;
  likeOn?: boolean;
}): Promise<void> {
  await fetch(apiUrl("/api/stats/event"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
