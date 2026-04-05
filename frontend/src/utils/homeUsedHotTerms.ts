import { HOME_USED_HOT_TERMS_KEY } from "../constants/storageKeys";

export function readUsedHotTerms(): Set<string> {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(HOME_USED_HOT_TERMS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string" && x.length > 0));
  } catch {
    return new Set();
  }
}

export function addUsedHotTerm(label: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const s = readUsedHotTerms();
    s.add(label);
    sessionStorage.setItem(HOME_USED_HOT_TERMS_KEY, JSON.stringify([...s]));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearUsedHotTerms(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(HOME_USED_HOT_TERMS_KEY);
  } catch {
    /* ignore */
  }
}
