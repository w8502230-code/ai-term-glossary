import { useEffect, useId, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FavoriteToggle } from "./FavoriteToggle";
import { useFavoritesList } from "../utils/favoritesStorage";

type TFavoritesOverlayProps = {
  open: boolean;
  onClose: () => void;
};

function getFocusableIn(container: HTMLElement): HTMLElement[] {
  const sel =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])';
  return Array.from(container.querySelectorAll<HTMLElement>(sel)).filter(
    (el) => el.offsetParent !== null || (el.getClientRects?.().length ?? 0) > 0
  );
}

export function FavoritesOverlay({ open, onClose }: TFavoritesOverlayProps) {
  const navigate = useNavigate();
  const list = useFavoritesList();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    previouslyFocusedRef.current = (document.activeElement as HTMLElement) ?? null;
    const t = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prev;
      previouslyFocusedRef.current?.focus?.();
      previouslyFocusedRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = getFocusableIn(panel);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose, list]);

  if (!open) return null;

  /** 队尾最新：展示时新收藏在上 */
  const displayOrder = [...list].reverse();

  return (
    <>
      <div
        className="fixed inset-0 z-[90] bg-black/40"
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-0 z-[100] flex flex-col bg-white shadow-[0_-8px_32px_rgba(0,0,0,0.12)] sm:inset-4 sm:m-auto sm:max-h-[min(80vh,640px)] sm:max-w-lg sm:rounded-2xl sm:ring-1 sm:ring-gray-200"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-4">
          <h2 id={titleId} className="text-lg font-semibold text-gray-900">
            我的收藏
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-full px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
            aria-label="关闭"
          >
            关闭
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-2 sm:px-5">
          {displayOrder.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">暂无收藏术语</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {displayOrder.map((t) => (
                <li key={t} className="flex items-center gap-2 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/explain?term=${encodeURIComponent(t)}`);
                      onClose();
                    }}
                    className="min-h-[44px] min-w-0 flex-1 touch-manipulation text-left text-base text-gray-900 underline-offset-2 hover:underline"
                  >
                    {t}
                  </button>
                  <FavoriteToggle term={t} compact />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-center text-xs text-gray-400">
            仅保存在本机浏览器，清除站点数据后可能丢失。
          </p>
        </div>
      </div>
    </>
  );
}
