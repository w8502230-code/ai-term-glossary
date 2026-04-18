import { useEffect, useState } from "react";
import { FAVORITES_STORAGE_KEY } from "../constants/storageKeys";

const MAX_FAVORITES = 100;

export const FAVORITES_CHANGED_EVENT = "ai-term-glossary-favorites-changed";

function normalizeTerm(raw: string): string {
  return raw.trim();
}

function parseStored(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string")
      .map((x) => normalizeTerm(x))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function readFavorites(): string[] {
  try {
    return parseStored(localStorage.getItem(FAVORITES_STORAGE_KEY));
  } catch {
    return [];
  }
}

function writeFavorites(terms: string[]): void {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(terms));
  } catch {
    /* quota / private mode */
  }
  window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
}

/** 与 URL / 服务端返回的 term 一致：trim；收藏时去重并将该项移到队尾（视为最新），超长从队首丢弃 */
export function addFavorite(rawTerm: string): string[] {
  const t = normalizeTerm(rawTerm);
  if (!t) return readFavorites();
  const prev = readFavorites();
  const without = prev.filter((x) => x !== t);
  const next = [...without, t];
  while (next.length > MAX_FAVORITES) next.shift();
  writeFavorites(next);
  return next;
}

export function removeFavorite(rawTerm: string): string[] {
  const t = normalizeTerm(rawTerm);
  if (!t) return readFavorites();
  const next = readFavorites().filter((x) => x !== t);
  writeFavorites(next);
  return next;
}

export function setFavorite(rawTerm: string, on: boolean): string[] {
  return on ? addFavorite(rawTerm) : removeFavorite(rawTerm);
}

export function isFavorite(rawTerm: string): boolean {
  const t = normalizeTerm(rawTerm);
  if (!t) return false;
  return readFavorites().includes(t);
}

/** 首页 / 解释页 / 收藏列表共用：本标签页内写入与跨标签 storage 事件均会刷新 */
export function useFavoritesList(): string[] {
  const [list, setList] = useState<string[]>(() => readFavorites());

  useEffect(() => {
    const sync = () => setList(readFavorites());
    sync();
    window.addEventListener(FAVORITES_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return list;
}

export { normalizeTerm as normalizeFavoriteTerm };
