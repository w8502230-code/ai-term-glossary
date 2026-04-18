import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { EngagementBar } from "../components/EngagementBar";
import { FavoriteToggle } from "../components/FavoriteToggle";
import { SKIP_HOME_VIEW_KEY } from "../constants/storageKeys";
import { defineTerm, fetchTermStats, postStatsEvent } from "../services/api";
import type { TDefineResponse } from "../types/api";

function explainFavoriteLeading(termForStorage: string) {
  return (
    <div
      className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-gray-600"
      role="group"
      aria-label="我的收藏"
    >
      <FavoriteToggle term={termForStorage} compact />
      <span className="text-xs font-medium text-gray-400">收藏</span>
    </div>
  );
}

export function ExplainPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const raw = params.get("term");
  const term = raw ? decodeURIComponent(raw) : "";

  const [status, setStatus] = useState<"loading" | "ok" | "err">("loading");
  const [data, setData] = useState<TDefineResponse | null>(null);
  const [termStats, setTermStats] = useState({ views: 0, likes: 0, shares: 0 });
  const viewPostedForTermRef = useRef<string | null>(null);

  const refreshTermStats = useCallback(async (t: string) => {
    const r = await fetchTermStats(t);
    if (r.ok) setTermStats({ views: r.views, likes: r.likes, shares: r.shares });
  }, []);

  const load = useCallback(async () => {
    if (!term.trim()) {
      navigate("/", { replace: true });
      return;
    }
    setStatus("loading");
    setData(null);
    try {
      const res = await defineTerm(term.trim());
      if (res.ok) {
        setData(res);
        setStatus("ok");
      } else {
        setData(res);
        setStatus("err");
      }
    } catch {
      setData({
        ok: false,
        error: "CLIENT",
        message: "加载失败，请重试或返回首页。",
      });
      setStatus("err");
    }
  }, [term, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    viewPostedForTermRef.current = null;
    const t = term.trim();
    if (!t) return;
    void refreshTermStats(t);
  }, [term, refreshTermStats]);

  useEffect(() => {
    if (status !== "ok" || !data?.ok) return;
    if (viewPostedForTermRef.current === data.term) return;
    viewPostedForTermRef.current = data.term;
    void postStatsEvent({ kind: "view", term: data.term });
    void refreshTermStats(data.term);
  }, [status, data, refreshTermStats]);

  if (!term.trim()) {
    return null;
  }

  return (
    <div className="animate-page-in mx-auto min-h-svh max-w-2xl px-4 pb-28 pt-10 sm:px-6 sm:pt-14">
      <h1 className="mb-8 text-center text-2xl font-normal text-gray-900 sm:text-3xl">
        {term.trim()}
      </h1>

      {status === "loading" && (
        <p className="text-center text-gray-500">正在生成解释…</p>
      )}

      {status === "err" && data && !data.ok && (
        <div className="rounded-lg border border-red-100 bg-red-50/80 px-4 py-4 text-center text-red-800">
          <p className="mb-4">{data.message}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="min-h-[44px] rounded-full bg-red-700 px-6 text-white transition hover:bg-red-800"
          >
            重试
          </button>
          <Link
            to="/"
            className="mt-3 block text-sm text-red-700 underline hover:no-underline"
          >
            返回首页
          </Link>
        </div>
      )}

      {status === "ok" && data?.ok && (
        <article className="space-y-8 text-left">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-600">
              专业定义 · 中文
            </h2>
            <p className="whitespace-pre-wrap text-base leading-relaxed text-gray-800">
              {data.professionalZh}
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-600">
              专业定义 · English
            </h2>
            <p className="whitespace-pre-wrap text-base leading-relaxed text-gray-800">
              {data.professionalEn}
            </p>
          </section>
          <section className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 sm:p-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              通俗解释
            </h2>
            <p className="whitespace-pre-wrap text-base leading-relaxed text-gray-800">
              {data.plainZh}
            </p>
          </section>

          <div className="border-t border-gray-100 pt-6">
            <EngagementBar
              variant="term"
              term={data.term}
              views={termStats.views}
              likes={termStats.likes}
              shares={termStats.shares}
              onRefresh={() => refreshTermStats(data.term)}
              leadingSlot={explainFavoriteLeading(data.term)}
            />
          </div>
        </article>
      )}

      {status === "err" && term.trim() && (
        <div className="mt-8 border-t border-gray-100 pt-6">
          <EngagementBar
            variant="term"
            term={term.trim()}
            views={termStats.views}
            likes={termStats.likes}
            shares={termStats.shares}
            onRefresh={() => refreshTermStats(term.trim())}
            leadingSlot={explainFavoriteLeading(term.trim())}
          />
        </div>
      )}

      <footer className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-sm sm:py-4">
        <div className="mx-auto flex max-w-2xl gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem(SKIP_HOME_VIEW_KEY, "1");
              navigate("/");
            }}
            className="min-h-[48px] flex-1 rounded-full border border-gray-200 bg-white text-base font-medium text-gray-800 transition hover:border-gray-300 hover:shadow-sm"
          >
            继续
          </button>
          <button
            type="button"
            onClick={() => navigate("/goodbye")}
            className="min-h-[48px] flex-1 rounded-full bg-gray-900 text-base font-medium text-white transition hover:bg-gray-800"
          >
            结束
          </button>
        </div>
      </footer>
    </div>
  );
}
