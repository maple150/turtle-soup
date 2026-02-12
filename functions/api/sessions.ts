import { turtleSoups, getTurtleSoupById } from "../_shared/turtleSoups";
import {
  createEmptySession,
  saveSession,
  type SessionData
} from "../_shared/sessions";

interface CreateBody {
  soupId?: string;
}

export const onRequest = async (context: any): Promise<Response> => {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  let body: CreateBody = {};
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    // 允许空 body，采用随机题目
  }

  let soup =
    (body.soupId && getTurtleSoupById(body.soupId)) ||
    turtleSoups[Math.floor(Math.random() * turtleSoups.length)];

  if (!soup) {
    return new Response(JSON.stringify({ error: "NO_SOUP_AVAILABLE" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const id =
    (crypto as any).randomUUID?.() ??
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  const session: SessionData = createEmptySession(id, soup.id);

  // 给每个房间一个统一的开场白，方便两个玩家看到相同内容
  session.history.push({
    role: "assistant",
    content:
      "欢迎来到海龟汤推理室，这一局的汤底已经选好。请根据开局描述自由发问，我会用「是 / 否 / 无关 / 无法确定」来回答你们，并适时给一点小提示。"
  });

  await saveSession(env, session);

  const payload = {
    sessionId: session.id,
    soup: {
      id: soup.id,
      title: soup.title,
      opening: soup.opening,
      difficulty: soup.difficulty,
      tags: soup.tags
    },
    history: session.history
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

