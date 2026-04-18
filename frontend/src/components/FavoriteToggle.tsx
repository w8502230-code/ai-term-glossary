import { useCallback, useMemo } from "react";
import {
  normalizeFavoriteTerm,
  setFavorite,
  useFavoritesList,
} from "../utils/favoritesStorage";

type TFavoriteToggleProps = {
  term: string;
  /** 列表行略紧凑 */
  compact?: boolean;
};

function IconFavoriteCheck({
  checked,
  compact,
}: {
  checked: boolean;
  compact: boolean;
}) {
  const box = compact ? "h-9 w-9" : "h-10 w-10";
  const icon = compact ? "h-[18px] w-[18px]" : "h-5 w-5";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md border-2 transition ${box} ${
        checked
          ? "border-blue-600 bg-blue-50 text-blue-700"
          : "border-gray-300 bg-white text-gray-400"
      }`}
      aria-hidden
    >
      {checked ? (
        <svg
          className={icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <span className={icon} />
      )}
    </span>
  );
}

export function FavoriteToggle({ term, compact = false }: TFavoriteToggleProps) {
  const list = useFavoritesList();
  const normalized = useMemo(() => normalizeFavoriteTerm(term), [term]);

  const checked = normalized ? list.includes(normalized) : false;

  const toggle = useCallback(() => {
    if (!normalized) return;
    setFavorite(term, !checked);
  }, [checked, normalized, term]);

  if (!normalized) return null;

  const label = checked ? "取消收藏" : "加入收藏";

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-700 transition hover:bg-gray-50"
      aria-label={label}
      aria-pressed={checked}
    >
      <IconFavoriteCheck checked={checked} compact={compact} />
    </button>
  );
}
