/** 句末标点 + 尾随空白（语音识别常把短语当成一句，会带句号等） */
const TRAILING_TERM_PUNCT_RE =
  /(?:[\s\u3000]*[\u3002\uFF0C\uFF1F\uFF01\u3001\uFF1B\uFF1A\uFF0E\u2026.,!?;:])+$/u;

/** 去掉术语/词组末尾仅起语调作用的标点，不改变词中间的符号 */
export function stripTrailingTermPunctuation(raw: string): string {
  let t = raw.trim();
  while (TRAILING_TERM_PUNCT_RE.test(t)) {
    t = t.replace(TRAILING_TERM_PUNCT_RE, "").trim();
  }
  return t;
}
