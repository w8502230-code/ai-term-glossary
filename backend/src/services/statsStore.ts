import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type TTermBucket = { views: number; likes: number; shares: number };

const MAX_TERM_LEN = 64;

type TPersistShape = {
  homeViews: number;
  site: { likes: number; shares: number };
  terms: Record<string, TTermBucket>;
};

const emptyTerm = (): TTermBucket => ({ views: 0, likes: 0, shares: 0 });

let state: TPersistShape = {
  homeViews: 0,
  site: { likes: 0, shares: 0 },
  terms: {},
};

const storePath = process.env.STATS_STORE_PATH?.trim();

function load(): void {
  if (!storePath || !existsSync(storePath)) return;
  try {
    const raw = JSON.parse(readFileSync(storePath, "utf8")) as TPersistShape;
    if (typeof raw.homeViews === "number") state.homeViews = raw.homeViews;
    if (raw.site && typeof raw.site.likes === "number")
      state.site.likes = raw.site.likes;
    if (raw.site && typeof raw.site.shares === "number")
      state.site.shares = raw.site.shares;
    if (raw.terms && typeof raw.terms === "object") state.terms = raw.terms;
  } catch {
    /* keep defaults */
  }
}

function save(): void {
  if (!storePath) return;
  try {
    writeFileSync(storePath, JSON.stringify(state), "utf8");
  } catch {
    /* ignore disk errors */
  }
}

load();

function normTerm(t: string): string | null {
  const x = t.trim().replace(/[\u0000-\u001F\u007F]/g, "");
  if (x.length === 0 || x.length > MAX_TERM_LEN) return null;
  return x;
}

export function getHomeSnapshot(): { homeViews: number; likes: number; shares: number } {
  return {
    homeViews: state.homeViews,
    likes: state.site.likes,
    shares: state.site.shares,
  };
}

export function getTermSnapshot(term: string): TTermBucket {
  const k = normTerm(term);
  if (!k) return emptyTerm();
  const t = state.terms[k] ?? emptyTerm();
  return {
    views: t.views,
    likes: state.site.likes,
    shares: state.site.shares,
  };
}

export function incHomeView(): void {
  state.homeViews++;
  save();
}

export function incTermView(term: string): void {
  const k = normTerm(term);
  if (!k) return;
  const cur = state.terms[k] ?? emptyTerm();
  cur.views++;
  state.terms[k] = cur;
  save();
}

/** 全站点赞计数（首页与解释页共用同一桶） */
export function applySiteLike(likeOn: boolean): void {
  if (likeOn) state.site.likes++;
  else state.site.likes = Math.max(0, state.site.likes - 1);
  save();
}

/** 全站转发计数（首页与解释页共用同一桶） */
export function incSiteShare(): void {
  state.site.shares++;
  save();
}
