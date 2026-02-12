import { getTurtleSoupById } from "../../../_shared/turtleSoups";
import {
  loadSession,
  saveSession,
  type ChatTurn
} from "../../../_shared/sessions";
import { HOST_SYSTEM_PROMPT } from "../../../_shared/hostPrompt";
import { callQianwenChat } from "../../../_shared/qianwenClient";
import type { ChatCompletionMessageParam } from "../../../_shared/types";

interface AskBody {
  question: string;
}

export const onRequest = async (context: any): Promise<Response> => {
  const { request, params, env } = context;
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

  const session = await loadSession(env, id);
  if (!session) {
    return new Response(JSON.stringify({ error: "NOT_FOUND" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  const soup = getTurtleSoupById(session.soupId);
  if (!soup) {
    return new Response(JSON.stringify({ error: "SOUP_NOT_FOUND" }), {
      status: 500,
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

  const question = body.question.trim();
  if (!question) {
    return new Response(JSON.stringify({ error: "EMPTY_QUESTION" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 将当前房间的历史对话转换为 LLM 需要的格式
  const historyMessages: ChatCompletionMessageParam[] = session.history.map(
    (turn: ChatTurn) => ({
      role: turn.role,
      content: turn.content
    })
  );

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
    ...historyMessages,
    {
      role: "user",
      content: `玩家的新提问或请求是：${question}`
    }
  ];

  try {
    const answer = await callQianwenChat(messages, { temperature: 0.6 });

    // 更新房间历史：追加这次问答
    session.history.push(
      { role: "user", content: question },
      { role: "assistant", content: answer }
    );

    await saveSession(env, session);

    return new Response(
      JSON.stringify({
        answer,
        history: session.history
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
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

