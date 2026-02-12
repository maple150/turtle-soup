export type ChatCompletionMessageRole = "system" | "user" | "assistant";

export interface ChatCompletionMessageParam {
  role: ChatCompletionMessageRole;
  content: string;
}

