/** 解释页点「继续」回首页时跳过首页浏览 +1（与 PRD §5.6 一致） */
export const SKIP_HOME_VIEW_KEY = "ai-term-glossary-skip-home-view";

/** 首页已点击过的「主推最新档」词条，下次回首页顺延到下一日期档 */
export const HOME_USED_HOT_TERMS_KEY = "ai-term-glossary-home-used-hot-terms";

/** 全站点赞：首页与解释页共用，避免两页各 +1 */
export const SITE_LIKED_STORAGE_KEY = "ai-term-glossary-liked-site";

/** 全站转发：浏览器会话内成功转发只上报一次 +1（两页都点转发仍计 1 次） */
export const SITE_SHARE_SESSION_KEY = "ai-term-glossary-site-share-reported";

/** 我的收藏：JSON 字符串数组，顺序队首最旧、队尾最新，最多 100 条（见 PRD §5.7） */
export const FAVORITES_STORAGE_KEY = "ai-term-glossary-favorites-v1";
