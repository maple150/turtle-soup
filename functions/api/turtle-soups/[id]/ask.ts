import { getTurtleSoupById } from "../../../_shared/turtleSoups";
import { HOST_SYSTEM_PROMPT } from "../../../_shared/hostPrompt";
import { callQianwenChat } from "../../../_shared/qianwenClient";
import type { ChatCompletionMessageParam } from "../../../_shared/types";

interface AskBody {
  question: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

export const onRequest = async (context: any): Promise<Response> => {
  const { request, params } = context;
  const id = params?.id as string | undefined;

  if (!id) {
    return new Response(JSON.stringify({ error: "MISSING_ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  const soup = getTurtleSoupById(id);
  if (!soup) {
    return new Response(JSON.stringify({ error: "NOT_FOUND" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  let body: AskBody;
  try {
    body = (await request.json()) as AskBody;
  } catch {
    return new Response(JSON.stringify({ error: "INVALID_JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!body.question || typeof body.question !== "string") {
    return new Response(JSON.stringify({ error: "INVALID_QUESTION" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const history = body.history ?? [];

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: HOST_SYSTEM_PROMPT
    },
    {
      role: "user",
      content: [
        "以下是本题的【真相】与【开局描述】（只给你看，玩家看不到）：",
        "",
        `【真相】:\n${soup.truth}`,
        "",
        `【开局描述】:\n${soup.opening}`,
        "",
        "下面是到目前为止的对话历史（如果有）："
      ].join("\n")
    },
    ...history.map<ChatCompletionMessageParam>((h) => ({
      role: h.role,
      content: h.content
    })),
    {
      role: "user",
      content: `玩家的新提问或请求是：${body.question}`
    }
  ];

  try {
    const answer = await callQianwenChat(messages, { temperature: 0.6 });
    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "QIANWEN_ERROR",
        message: err?.message ?? String(err)
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};

