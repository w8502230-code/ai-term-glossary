import { shuffle } from "./shuffle";

/** 词池条目：`addedAt` 用于划分「最新档」与「过往」（ISO 日期 YYYY-MM-DD）。 */
export type TTermEntry = { label: string; addedAt: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** 兼容旧版纯字符串数组，或 `{ label, addedAt? }` 对象数组。 */
export function normalizeTermPool(raw: unknown): TTermEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: TTermEntry[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const label = item.trim();
      if (label) out.push({ label, addedAt: "1970-01-01" });
      continue;
    }
    if (!isRecord(item)) continue;
    const label = typeof item.label === "string" ? item.label.trim() : "";
    if (!label) continue;
    const addedAt =
      typeof item.addedAt === "string" && item.addedAt.trim().length > 0
        ? item.addedAt.trim()
        : "1970-01-01";
    out.push({ label, addedAt });
  }
  return out;
}

export type THomeCardsPick = {
  cards: string[];
  /** 本屏「主推最新」槽位（洗牌前已定；用户点该词后下回首页会顺延下一日期档） */
  hotLabel: string;
  /** 排除记录已占满所有日期档，已回退到绝对最新档；调用方应 `clearUsedHotTerms()` */
  hotExclusionsExhausted: boolean;
};

function pickHotLabel(
  entries: TTermEntry[],
  excluded: ReadonlySet<string>
): { hot: string; exhausted: boolean } {
  const distinctDates = [...new Set(entries.map((e) => e.addedAt))].sort((a, b) =>
    b.localeCompare(a)
  );
  if (distinctDates.length === 0) return { hot: "", exhausted: false };

  for (const d of distinctDates) {
    const labels = shuffle([
      ...new Set(entries.filter((e) => e.addedAt === d).map((e) => e.label)),
    ]).filter((l) => !excluded.has(l));
    if (labels.length > 0) {
      return {
        hot: labels[Math.floor(Math.random() * labels.length)],
        exhausted: false,
      };
    }
  }

  const top = distinctDates[0];
  const fallback = shuffle([
    ...new Set(entries.filter((e) => e.addedAt === top).map((e) => e.label)),
  ]);
  return {
    hot: fallback[Math.floor(Math.random() * fallback.length)] ?? "",
    exhausted: true,
  };
}

/** 首页三卡：1 张为「主推最新」（按日期档顺延，见 `excludedHotLabels`），2 张优先更早词条，再整体洗牌。 */
export function pickThreeTermsWithOneLatest(
  entries: TTermEntry[],
  excludedHotLabels: ReadonlySet<string> = new Set()
): THomeCardsPick {
  const uniqueLabels = [...new Set(entries.map((e) => e.label))];
  if (entries.length === 0) {
    return { cards: [], hotLabel: "", hotExclusionsExhausted: false };
  }

  if (uniqueLabels.length <= 3) {
    const { hot, exhausted } = pickHotLabel(entries, excludedHotLabels);
    const others = shuffle(uniqueLabels.filter((l) => l !== hot));
    const cards = shuffle([hot, ...others]).slice(0, Math.min(3, uniqueLabels.length));
    return { cards, hotLabel: hot, hotExclusionsExhausted: exhausted };
  }

  const maxDate = entries.reduce((m, e) => (e.addedAt > m ? e.addedAt : m), entries[0].addedAt);
  const globalOlder = entries.filter((e) => e.addedAt < maxDate);

  if (globalOlder.length === 0) {
    const { hot, exhausted } = pickHotLabel(entries, excludedHotLabels);
    const pastPool = shuffle(uniqueLabels.filter((l) => l !== hot));
    const rest: string[] = [];
    for (const label of pastPool) {
      if (rest.length >= 2) break;
      rest.push(label);
    }
    const more = shuffle(uniqueLabels.filter((l) => l !== hot && !rest.includes(l)));
    while (rest.length < 2 && more.length > 0) {
      rest.push(more.pop()!);
    }
    return {
      cards: shuffle([hot, ...rest.slice(0, 2)]),
      hotLabel: hot,
      hotExclusionsExhausted: exhausted,
    };
  }

  const { hot, exhausted } = pickHotLabel(entries, excludedHotLabels);
  const hotDate = entries.find((e) => e.label === hot)?.addedAt ?? maxDate;
  const olderEntries = entries.filter((e) => e.addedAt < hotDate);

  const pastPool = shuffle([...new Set(olderEntries.map((e) => e.label))]);
  const rest: string[] = [];
  for (const label of pastPool) {
    if (rest.length >= 2) break;
    rest.push(label);
  }

  const more = shuffle(uniqueLabels.filter((l) => l !== hot && !rest.includes(l)));
  while (rest.length < 2 && more.length > 0) {
    rest.push(more.pop()!);
  }

  return {
    cards: shuffle([hot, ...rest.slice(0, 2)]),
    hotLabel: hot,
    hotExclusionsExhausted: exhausted,
  };
}
