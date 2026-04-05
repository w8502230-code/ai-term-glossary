import { fetch as undiciFetch, ProxyAgent } from "undici";
import type { RequestInit as UndiciRequestInit } from "undici";

function compatChatUrl(): string {
  const base = (process.env.BAILIAN_BASE_URL || "https://dashscope.aliyuncs.com").replace(
    /\/$/,
    ""
  );
  return `${base}/compatible-mode/v1/chat/completions`;
}

function zhipuChatUrl(): string {
  return (
    process.env.ZHIPU_BASE_URL?.trim() ||
    "https://open.bigmodel.cn/api/paas/v4/chat/completions"
  ).replace(/\/$/, "");
}

/** 统一用 undici fetch；无代理时用默认 dispatcher，与 Node 内置 fetch 行为一致。 */
function upstreamFetch(url: string, init: RequestInit) {
  const proxy =
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    process.env.https_proxy?.trim() ||
    process.env.http_proxy?.trim();
  const opts: UndiciRequestInit = {
    method: init.method,
    headers: init.headers,
    body: init.body as UndiciRequestInit["body"],
    signal: init.signal,
    ...(proxy ? { dispatcher: new ProxyAgent(proxy) } : {}),
  };
  return undiciFetch(url, opts);
}

const SYSTEM_PROMPT = `你是 **AI / IT 术语**科普助手。用户输入可能是中文或英文词/短语。
你必须只输出一个 JSON 对象，不要 markdown 代码围栏，不要任何其它文字。

【领域边界：写死在 IT / AI 内，禁止跨界】
- 所有解释**必须且只能**落在：**信息技术（IT）、人工智能（AI）、机器学习、深度学习、大语言模型、数据与软件工程、开发者工具与 API** 等范畴。
- **禁止**使用日常生活、基础物理、化学、生物、一般文史、财经等非 IT/AI 学科的主流含义作答——即使该词在其它领域更常见也必须忽略。
- 对普通英文单词或易混词：若在 ML/LLM/软件产品中存在**约定俗成的技术义**，**必须优先采用该技术义**，不得按「字典第一义」或物理课释义输出。
- **反例（禁止）**：将 "Temperature" /「温度」在**本应用内**解释成「分子热运动、摄氏度/华氏度」等热力学温度；**正例（必须）**：解释为**大语言模型等生成模型中的 sampling temperature（采样温度）超参数**，即调节输出随机性/发散程度（与 softmax 分布尖锐度相关）的设置。
- 若用户输入明显是纯生活词且**在 IT/AI 中无稳定术语义**，可简要说明在 AI 语境下一般不单独作为术语使用，并**最接近的 IT 概念**是什么（仍不要改讲物理学）。

JSON 必须严格包含三个字符串字段：

【专业段：只做定义性摘编，禁止扩展发挥】
- professionalZh：2～5 句，简体中文。内容须为「定义性表述」的摘编：应等价于权威技术百科、官方文档或学界/业界**通行定义**的压缩版本；若你掌握标准表述，**允许原句照搬**；若原文偏长，**仅可在不改变命题、范围与因果关系的前提下缩写**。**禁止**：补充定义之外的背景故事、教学展开、修辞堆砌、个人推断、营销话术，以及任何未在通行定义中出现的「延伸释义」。
- professionalEn：2～5 句，英文。与 professionalZh **同一定义、同一信息边界**，亦为摘编级表述；规则同上，禁止比中文段多出额外观点。

【通俗段：只复述，不新增】
- plainZh：2～5 句，简体中文。只对 professionalZh **已经写明的含义**做句式简化（更口语），**不得新增** professional 未出现的判断、场景或比喻。**禁止**用音乐、舞蹈、情绪节奏等与 AI/软件工程定义无关的喻体来「帮助理解」，除非该术语在 professional 段已明确是隐喻类概念。

【事实与消歧】
- 英文新词、梗词、社群用语：必须按 **AI/IT 语境下的通行技术含义** 摘编；**禁止**望文生义。示例（错误）：把 "vibe coding" 说成音乐节奏。**正确方向**：LLM/AI 编程协作范式（见前文规则）。
- **多义词**：在「IT/AI 技术义」与「其它学科义」之间，**永远只选 IT/AI 技术义**；不要并列科普物理/化学含义。
- 不确定具体出处时**不要编造**人名、论文、年份；摘编只写你确信属于通行定义的内容。

【专名（CamelCase / 产品名）：禁止张冠李戴】
- 对用户输入中像 **软件或开源项目专名** 的英文（如 OpenXxx、XxxClaw 等大小写混写）：**禁止**为了「凑定义」而改写成**法律科技、合同审查、诉讼文书 NLP、合规尽调**等与 **开发者工具 / 智能体 / 自动化** 无关的领域——除非该专名在公开技术资料中的**主义项**确为此类 SaaS（绝大多数情况下不是）。
- 若专名在 AI 圈指 **开源智能体、本地自动化、工具编排、LLM 网关**，应优先按 **Agent + 工具调用（function calling）+ 执行任务 + 隐私/本地部署** 等 IT 语义场摘编。
- **反例（绝对禁止）**：将 **OpenClaw** 解释成「从法律合同中抽取条款的法律 NLP 工具」等——这是典型误生成；正确方向是 **自主 AI 智能体 / AI 执行网关**（连接模型与本地或聊天应用去完成事务性任务）。`;

function defineUserMessage(term: string): string {
  return `术语：${term}
本应用只解释 **IT / 人工智能 / 机器学习 / 大模型与软件开发** 中的含义；禁止物理、日常生活等其它领域释义。请按该领域通行定义做摘编：professional 两段只做摘编或忠实缩写，plain 只做复述。仅输出 JSON：
{"professionalZh":"","professionalEn":"","plainZh":""}`;
}

export type TDefineFields = {
  professionalZh: string;
  professionalEn: string;
  plainZh: string;
};

/** Qwen3 等模型常在 JSON 前输出推理块，会导致 JSON.parse 失败并误报「服务不可用」。 */
function stripOneBlock(s: string, open: string, close: string): string {
  let t = s;
  while (true) {
    const i = t.indexOf(open);
    if (i < 0) break;
    const j = t.indexOf(close, i + open.length);
    if (j < 0) break;
    t = t.slice(0, i) + t.slice(j + close.length);
  }
  return t;
}

function stripReasoningNoise(s: string): string {
  const thinkOpen = "<" + "think" + ">";
  const thinkClose = "</" + "think" + ">";
  const rOpen = "<" + "reasoning" + ">";
  const rClose = "</" + "reasoning" + ">";
  const rrOpen = "<" + "redacted" + "_" + "reasoning" + ">";
  const rrClose = "</" + "redacted" + "_" + "reasoning" + ">";
  const rtOpen = "<" + "redacted" + "_" + "thinking" + ">";
  const rtClose = "</" + "redacted" + "_" + "thinking" + ">";
  let t = stripOneBlock(s, thinkOpen, thinkClose);
  t = stripOneBlock(t, rOpen, rClose);
  t = stripOneBlock(t, rrOpen, rrClose);
  t = stripOneBlock(t, rtOpen, rtClose);
  return t.trim();
}

/** 兼容百炼 OpenAI 形态：正文可能在 content，推理/补充可能在 reasoning_content；多段 content 为数组时取 text。 */
function assistantMessageToText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const m = message as {
    content?: unknown;
    reasoning_content?: unknown;
  };
  const parts: string[] = [];
  if (typeof m.content === "string" && m.content.trim()) parts.push(m.content);
  if (typeof m.reasoning_content === "string" && m.reasoning_content.trim()) {
    parts.push(m.reasoning_content);
  }
  if (Array.isArray(m.content)) {
    for (const item of m.content) {
      if (
        item &&
        typeof item === "object" &&
        "text" in item &&
        typeof (item as { text: unknown }).text === "string"
      ) {
        const tx = (item as { text: string }).text.trim();
        if (tx) parts.push(tx);
      }
    }
  }
  return parts.join("\n").trim();
}

function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no_json");
  const jsonSlice = candidate.slice(start, end + 1);
  try {
    return JSON.parse(jsonSlice) as Record<string, unknown>;
  } catch {
    throw new Error("no_json");
  }
}

function validateFields(o: Record<string, unknown>): TDefineFields {
  const z = o.professionalZh;
  const e = o.professionalEn;
  const p = o.plainZh;
  if (typeof z !== "string" || typeof e !== "string" || typeof p !== "string")
    throw new Error("bad_fields");
  const professionalZh = z.trim();
  const professionalEn = e.trim();
  const plainZh = p.trim();
  if (!professionalZh || !professionalEn || !plainZh) throw new Error("empty_field");
  return { professionalZh, professionalEn, plainZh };
}

async function callBailianOnce(
  apiKey: string,
  model: string,
  term: string
): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 38_000);
  try {
    const chatUrl = compatChatUrl();
    const res = await upstreamFetch(chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: (() => {
        const payload: Record<string, unknown> = {
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: defineUserMessage(term),
            },
          ],
          temperature: 0.1,
        };
        // 默认要求 JSON 输出（与提示词一致）；若百炼返回 400，可在 .env 设 BAILIAN_JSON_OBJECT=0 关闭
        if (process.env.BAILIAN_JSON_OBJECT !== "0") {
          payload.response_format = { type: "json_object" };
        }
        return JSON.stringify(payload);
      })(),
      signal: controller.signal,
    });
    const raw = await res.text();
    if (!res.ok) {
      let hint = "";
      try {
        const errBody = JSON.parse(raw) as { message?: string; code?: string };
        hint = [errBody.code, errBody.message].filter(Boolean).join(" ");
        if (hint) console.error("bailian_http", res.status, hint.slice(0, 200));
      } catch {
        console.error("bailian_http", res.status, raw.slice(0, 200));
      }
      const e = new Error(`upstream_${res.status}`) as Error & { bailianHint?: string };
      e.bailianHint = hint;
      throw e;
    }
    let data: { choices?: Array<{ message?: unknown }> };
    try {
      data = JSON.parse(raw) as { choices?: Array<{ message?: unknown }> };
    } catch {
      console.error("bailian_body_not_json", raw.slice(0, 300));
      throw new Error("bad_upstream_body");
    }
    const content = assistantMessageToText(data.choices?.[0]?.message);
    if (!content) throw new Error("no_content");
    return content;
  } finally {
    clearTimeout(t);
  }
}

async function callZhipuOnce(
  apiKey: string,
  model: string,
  term: string
): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 38_000);
  try {
    const chatUrl = zhipuChatUrl();
    const payload: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: defineUserMessage(term),
        },
      ],
      temperature: 0.1,
    };
    if (process.env.ZHIPU_JSON_OBJECT !== "0") {
      payload.response_format = { type: "json_object" };
    }
    const res = await upstreamFetch(chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const raw = await res.text();
    if (!res.ok) {
      let hint = "";
      try {
        const errBody = JSON.parse(raw) as { message?: string; code?: string; error?: string };
        hint = [errBody.code, errBody.message, errBody.error].filter(Boolean).join(" ");
        if (hint) console.error("zhipu_http", res.status, hint.slice(0, 200));
      } catch {
        console.error("zhipu_http", res.status, raw.slice(0, 200));
      }
      const e = new Error(`upstream_${res.status}`) as Error & { zhipuHint?: string };
      e.zhipuHint = hint;
      throw e;
    }
    let data: { choices?: Array<{ message?: unknown }> };
    try {
      data = JSON.parse(raw) as { choices?: Array<{ message?: unknown }> };
    } catch {
      console.error("zhipu_body_not_json", raw.slice(0, 300));
      throw new Error("bad_upstream_body");
    }
    const content = assistantMessageToText(data.choices?.[0]?.message);
    if (!content) throw new Error("no_content");
    return content;
  } finally {
    clearTimeout(t);
  }
}

async function defineWithRetries(fetchOnce: () => Promise<string>): Promise<TDefineFields> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = stripReasoningNoise(await fetchOnce());
      const obj = extractJsonObject(text);
      return validateFields(obj);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export async function defineTermWithBailian(
  apiKey: string,
  model: string,
  term: string
): Promise<TDefineFields> {
  return defineWithRetries(() => callBailianOnce(apiKey, model, term));
}

export async function defineTermWithZhipu(
  apiKey: string,
  model: string,
  term: string
): Promise<TDefineFields> {
  return defineWithRetries(() => callZhipuOnce(apiKey, model, term));
}
