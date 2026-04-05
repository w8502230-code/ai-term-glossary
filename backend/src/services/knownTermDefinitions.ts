import type { TDefineFields } from "./aiProvider.js"; // type-only，避免运行时环依赖

/** 与 LLM 无关的稳定键：去空白、小写，便于匹配 OpenClaw / open claw */
function knownTermKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

/** 模型易张冠李戴或训练集未覆盖的专名，走后端摘编以保证义项正确 */
const KNOWN: Record<string, TDefineFields> = {
  openclaw: {
    professionalZh:
      "OpenClaw（社区常称「小龙虾」）指一类开源的自主 AI 智能体（Agent）项目或产品形态：在本地或可信赖环境中把大语言模型与工具调用结合，用于自动规划并执行处理邮件、文件、浏览器、日历、即时通讯等实际任务，目标不是单纯聊天。其常见表述是强调隐私与执行力的「AI 执行网关」或控制器：一侧连接 GPT、Claude、本地 Llama 等模型做推理，另一侧对接用户设备与应用完成操作。",
    professionalEn:
      "OpenClaw denotes an open-source autonomous AI agent stack that connects large language models to tools and local integrations (email, files, browsers, calendars, chat apps) to plan and execute real-world tasks rather than chat only. It is often described as an AI execution gateway or controller: models handle reasoning while the system bridges to the user’s environment for action.",
    plainZh:
      "可以把它理解成「真正干活的 AI」：不只会聊，还能在你允许的前提下自动拆步骤、调工具，去连你的电脑和常用软件把事情办完；模型负责想，系统负责做。",
  },
};

export function tryKnownTermDefinition(term: string): TDefineFields | null {
  const key = knownTermKey(term);
  const hit = KNOWN[key];
  return hit ? { ...hit } : null;
}
