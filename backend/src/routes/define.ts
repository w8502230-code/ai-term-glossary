import { Router } from "express";
import { globalDefineRateLimit } from "../middlewares/globalDefineRateLimit.js";
import { defineTermWithBailian, defineTermWithZhipu } from "../services/aiProvider.js";
import { tryKnownTermDefinition } from "../services/knownTermDefinitions.js";

export const defineRouter = Router();

const MAX_TERM_LEN = 64;

function sanitizeTerm(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/[\u0000-\u001F\u007F]/g, "");
  if (t.length === 0 || t.length > MAX_TERM_LEN) return null;
  return t;
}

defineRouter.post("/define", globalDefineRateLimit, async (req, res) => {
  const provider = (process.env.LLM_PROVIDER || "bailian").trim().toLowerCase();
  const useZhipu = provider === "zhipu";
  const apiKey = useZhipu
    ? process.env.ZHIPU_API_KEY?.trim()
    : process.env.BAILIAN_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({
      ok: false,
      error: "UPSTREAM_ERROR",
      message: useZhipu
        ? "服务未配置智谱 API Key，请设置 ZHIPU_API_KEY；或使用百炼时在 .env 设 LLM_PROVIDER=bailian。"
        : "服务未配置百炼 API Key，请设置环境变量 BAILIAN_API_KEY；或使用智谱时设 LLM_PROVIDER=zhipu 与 ZHIPU_API_KEY。",
    });
    return;
  }

  const term = sanitizeTerm(req.body?.term);
  if (!term) {
    res.status(400).json({
      ok: false,
      error: "INVALID_TERM",
      message: "请输入 1～64 个字符的有效术语。",
    });
    return;
  }

  const model = useZhipu
    ? process.env.ZHIPU_MODEL?.trim() || "glm-4-flash"
    : process.env.BAILIAN_MODEL?.trim() || "qwen-turbo-latest";

  const curated = tryKnownTermDefinition(term);
  if (curated) {
    res.json({
      ok: true,
      term,
      professionalZh: curated.professionalZh,
      professionalEn: curated.professionalEn,
      plainZh: curated.plainZh,
    });
    return;
  }

  try {
    const fields = useZhipu
      ? await defineTermWithZhipu(apiKey, model, term)
      : await defineTermWithBailian(apiKey, model, term);
    res.json({
      ok: true,
      term,
      professionalZh: fields.professionalZh,
      professionalEn: fields.professionalEn,
      plainZh: fields.plainZh,
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    const msg = e instanceof Error ? e.message : "";
    const cause = (e as Error & { cause?: unknown }).cause;
    let causeHint = "";
    if (cause instanceof Error) {
      causeHint = `${cause.name}: ${cause.message}`.slice(0, 200);
    } else if (cause && typeof cause === "object" && "code" in cause) {
      causeHint = String((cause as { code: unknown }).code);
    }
    if (name === "TypeError" && /fetch failed/i.test(msg)) {
      console.error("[define-network]", causeHint || "no_cause");
      const curlHint = useZhipu
        ? "curl -I https://open.bigmodel.cn"
        : "curl -I https://dashscope.aliyuncs.com";
      const baseMsg = useZhipu
        ? `无法连接到智谱服务器（请求可能未发出：网络、防火墙、代理或 DNS）。请在运行后端的同一台电脑执行：${curlHint} 。可在 .env 设置 HTTPS_PROXY 指向本机 HTTP 代理端口。`
        : `无法连接到百炼服务器（请求可能未发出：网络、防火墙、代理或 DNS 问题）。请在运行后端的同一台电脑上打开终端执行：${curlHint} 。若在公司网络，可能需要配置系统或 Node 的 HTTPS 代理；国际地域可在 .env 设置 BAILIAN_BASE_URL=https://dashscope-intl.aliyuncs.com 。`;
      const proxyConfigured = Boolean(
        process.env.HTTPS_PROXY?.trim() ||
          process.env.HTTP_PROXY?.trim() ||
          process.env.https_proxy?.trim() ||
          process.env.http_proxy?.trim()
      );
      const timeoutExtra =
        /ConnectTimeout|ETIMEDOUT|timeout/i.test(causeHint)
          ? useZhipu
            ? proxyConfigured
              ? " 仍为连接超时：请核对 HTTPS_PROXY 端口与 Clash/V2Ray 的「HTTP 代理」一致，并开启「允许局域网连接」。"
              : " 连接超时且当前未配置 HTTPS_PROXY：Node 不会自动走系统代理。请在项目根 .env 增加 HTTPS_PROXY=http://127.0.0.1:端口（常见 7890/10809），与海龟汤无关——两个项目的后端都要各自配置并重启。"
            : " 当前错误为连接超时：若账号在国际站开通，请优先尝试上述 BAILIAN_BASE_URL；否则检查本机/路由器防火墙是否拦截出境 HTTPS。"
          : "";
      res.status(502).json({
        ok: false,
        error: "NETWORK_ERROR",
        message: baseMsg + timeoutExtra,
      });
      return;
    }
    if (name === "AbortError" || msg.includes("aborted")) {
      res.status(504).json({
        ok: false,
        error: "UPSTREAM_TIMEOUT",
        message: "生成超时，请稍后重试。",
      });
      return;
    }
    if (msg === "no_json" || msg === "bad_fields" || msg === "empty_field") {
      res.status(502).json({
        ok: false,
        error: "PARSE_ERROR",
        message: "暂时无法解析模型结果，请重试。",
      });
      return;
    }
    if (e instanceof SyntaxError || msg.includes("Unexpected token")) {
      res.status(502).json({
        ok: false,
        error: "PARSE_ERROR",
        message:
          "模型返回内容无法解析为 JSON，请重试；若上游不支持 json_object，可设 BAILIAN_JSON_OBJECT=0 或 ZHIPU_JSON_OBJECT=0。",
      });
      return;
    }
    const upstream = msg.match(/^upstream_(\d+)$/);
    if (upstream) {
      const httpCode = Number(upstream[1]);
      let userMsg = "服务暂时不可用，请稍后重试。";
      if (httpCode === 401 || httpCode === 403) {
        userMsg = useZhipu
          ? "智谱 API Key 无效、过期或无权调用，请核对 .env 中的 ZHIPU_API_KEY。"
          : "百炼 API Key 无效、过期或无权调用，请核对 .env 中的 BAILIAN_API_KEY（百炼控制台复制的 Key），并确认已开通模型。";
      } else if (httpCode === 400 || httpCode === 404) {
        userMsg = useZhipu
          ? "请求被拒绝：请检查 ZHIPU_MODEL 与智谱控制台一致（可尝试 glm-4-flash）。"
          : "请求被拒绝：请检查 BAILIAN_MODEL 与控制台模型名一致（可尝试 qwen-turbo-latest 或 qwen-plus）。";
      } else if (httpCode === 429) {
        userMsg = "调用过于频繁，请稍后再试。";
      }
      console.error("define_upstream", httpCode, msg);
      res.status(502).json({
        ok: false,
        error: "UPSTREAM_ERROR",
        message: userMsg,
      });
      return;
    }
    if (msg === "no_content" || msg === "bad_upstream_body") {
      res.status(502).json({
        ok: false,
        error: "UPSTREAM_ERROR",
        message: useZhipu
          ? "智谱返回内容异常，请重试或更换 ZHIPU_MODEL。"
          : "百炼返回内容异常，请重试或更换 BAILIAN_MODEL。",
      });
      return;
    }
    console.error("define_error", msg || e);
    console.error(
      "[define-fail]",
      JSON.stringify({
        branch: "generic_fallback",
        errorName: name,
        errorMsg: msg.slice(0, 320),
      })
    );
    res.status(502).json({
      ok: false,
      error: "UPSTREAM_ERROR",
      message: "服务暂时不可用，请稍后重试。",
    });
  }
});
