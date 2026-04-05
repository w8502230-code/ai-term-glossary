import { useCallback, useEffect, useState } from "react";
import { SITE_LIKED_STORAGE_KEY, SITE_SHARE_SESSION_KEY } from "../constants/storageKeys";
import { postStatsEvent } from "../services/api";

type TEngagementBarProps = {
  variant: "home" | "term";
  term?: string;
  views: number;
  likes: number;
  shares: number;
  onRefresh: () => Promise<void>;
};

function readLiked(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** 兼容旧版仅首页使用的 localStorage 键 */
function migrateLegacyHomeLike(): void {
  try {
    const legacy = "ai-term-glossary-liked-home";
    if (localStorage.getItem(SITE_LIKED_STORAGE_KEY) === "1") return;
    if (localStorage.getItem(legacy) === "1") {
      localStorage.setItem(SITE_LIKED_STORAGE_KEY, "1");
      localStorage.removeItem(legacy);
    }
  } catch {
    /* ignore */
  }
}

function writeLiked(key: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function IconHeart({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  }
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  );
}

/** 转发：自底向上送出，语义接近微信小视频「转发」 */
function IconForward() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 6l-4-4-4 4M12 2v13" />
    </svg>
  );
}

export function EngagementBar({
  variant,
  term,
  views,
  likes,
  shares,
  onRefresh,
}: TEngagementBarProps) {
  const [liked, setLiked] = useState(() => {
    migrateLegacyHomeLike();
    return readLiked(SITE_LIKED_STORAGE_KEY);
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    migrateLegacyHomeLike();
    setLiked(readLiked(SITE_LIKED_STORAGE_KEY));
  }, [variant, term]);

  const toggleLike = useCallback(async () => {
    if (busy) return;
    if (variant === "term" && !term?.trim()) return;
    setBusy(true);
    const next = !liked;
    try {
      await postStatsEvent({ kind: "like", likeOn: next });
      setLiked(next);
      writeLiked(SITE_LIKED_STORAGE_KEY, next);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }, [busy, liked, onRefresh]);

  const doShare = useCallback(async () => {
    if (busy) return;
    const url =
      variant === "home"
        ? `${window.location.origin}/`
        : `${window.location.origin}/explain?term=${encodeURIComponent(term ?? "")}`;

    const finish = async () => {
      try {
        if (sessionStorage.getItem(SITE_SHARE_SESSION_KEY) !== "1") {
          sessionStorage.setItem(SITE_SHARE_SESSION_KEY, "1");
          await postStatsEvent({ kind: "share" });
        }
      } catch {
        /* ignore */
      }
      await onRefresh();
    };

    setBusy(true);
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: "AI 术语普及", url });
          await finish();
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
          await navigator.clipboard.writeText(url);
          await finish();
        }
      } else {
        await navigator.clipboard.writeText(url);
        await finish();
      }
    } catch {
      /* clipboard / share failed */
    } finally {
      setBusy(false);
    }
  }, [busy, onRefresh, term, variant]);

  return (
    <div
      className="flex items-center justify-center gap-6 tabular-nums text-gray-600 sm:gap-8"
      role="group"
      aria-label="互动"
    >
      <button
        type="button"
        onClick={() => void toggleLike()}
        disabled={busy || (variant === "term" && !term?.trim())}
        className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 text-gray-600 transition hover:text-red-500 disabled:opacity-40"
        aria-label={liked ? "取消点赞" : "点赞"}
        aria-pressed={liked}
      >
        <span className={liked ? "text-red-500" : ""}>
          <IconHeart filled={liked} />
        </span>
        <span className="text-xs font-medium">{likes}</span>
      </button>

      <button
        type="button"
        onClick={() => void doShare()}
        disabled={busy || (variant === "term" && !term?.trim())}
        className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 text-gray-600 transition hover:text-blue-600 disabled:opacity-40"
        aria-label="转发"
      >
        <IconForward />
        <span className="text-xs font-medium">{shares}</span>
      </button>

      <div
        className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-gray-500"
        aria-label={`浏览次数 ${views}`}
      >
        <span className="text-xs font-medium tracking-wide text-gray-400">views</span>
        <span className="text-sm font-semibold text-gray-700">{views}</span>
      </div>
    </div>
  );
}
