import type { TDefineResponse } from "../types/api";
import type { THomeStatsResponse, TStatsErrorResponse, TTermStatsResponse } from "../types/stats";
import { apiUrl } from "../utils/apiBase";

export async function defineTerm(term: string): Promise<TDefineResponse> {
  const res = await fetch(apiUrl("/api/define"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ term }),
  });
  const data = (await res.json()) as TDefineResponse;
  return data;
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
