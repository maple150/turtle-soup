import type { ChatCompletionMessageParam } from "./types";

// 按你的要求：这里直接写死免费的通义千问 Key。
// 强烈不建议在真实项目里这样做，因为任何看到源码的人都可以滥用这个 Key。
const QIANWEN_API_KEY = "sk-6533c949f54f4a088680624b03c16b4c";

// 通义千问兼容 OpenAI 的 Chat Completions 接口（DashScope 兼容模式）
// 文档可能会更新，如果无法调用，可以到通义千问官网查看最新的兼容模式地址。
const QIANWEN_ENDPOINT =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

// 你可以根据自己的账号情况更换为其他模型名称，例如：qwen-turbo / qwen-plus 等
const QIANWEN_MODEL = "qwen-plus";

export interface QianwenChatOptions {
  temperature?: number;
}

export async function callQianwenChat(
  messages: ChatCompletionMessageParam[],
  options: QianwenChatOptions = {}
): Promise<string> {
  const body = {
    model: QIANWEN_MODEL,
    messages,
    temperature: options.temperature ?? 0.7
  };

  const resp = await fetch(QIANWEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${QIANWEN_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("Qianwen API error:", resp.status, text);
    throw new Error(`Qianwen API request failed: ${resp.status}`);
  }

  const json = (await resp.json()) as any;
  const content =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.message?.messages?.[0]?.content;

  if (!content || typeof content !== "string") {
    console.error("Unexpected Qianwen response:", JSON.stringify(json, null, 2));
    throw new Error("Invalid response from Qianwen API");
  }

  return content;
}

