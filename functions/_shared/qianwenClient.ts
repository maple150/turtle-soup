import type { ChatCompletionMessageParam } from "./types";

const DEFAULT_QIANWEN_ENDPOINT =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const DEFAULT_QIANWEN_MODEL = "qwen-plus";

export interface QianwenChatOptions {
  temperature?: number;
}

export interface QianwenEnv {
  QIANWEN_API_KEY?: string;
  QIANWEN_ENDPOINT?: string;
  QIANWEN_MODEL?: string;
}

function getQianwenConfig(env?: QianwenEnv) {
  const apiKey = env?.QIANWEN_API_KEY;
  if (!apiKey) {
    throw new Error("QIANWEN_API_KEY is not configured");
  }

  return {
    apiKey,
    endpoint: env?.QIANWEN_ENDPOINT ?? DEFAULT_QIANWEN_ENDPOINT,
    model: env?.QIANWEN_MODEL ?? DEFAULT_QIANWEN_MODEL
  };
}

export async function callQianwenChat(
  messages: ChatCompletionMessageParam[],
  options: QianwenChatOptions = {},
  env?: QianwenEnv
): Promise<string> {
  const config = getQianwenConfig(env);

  const body = {
    model: config.model,
    messages,
    temperature: options.temperature ?? 0.7
  };

  const resp = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
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
