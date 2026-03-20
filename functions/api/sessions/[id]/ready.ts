import { getTurtleSoupById } from "../../../_shared/turtleSoups";
import {
  addSessionEvent,
  buildSessionPayload,
  loadSession,
  saveSession,
  setPlayerReady,
  type VisibleSoup
} from "../../../_shared/sessions";

interface ReadyBody {
  playerId?: string;
  ready?: boolean;
}

function toVisibleSoup(soupId: string): VisibleSoup | null {
  const soup = getTurtleSoupById(soupId);
  if (!soup) return null;
  return {
    id: soup.id,
    title: soup.title,
    opening: soup.opening,
    difficulty: soup.difficulty,
    tags: soup.tags
  };
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

  let body: ReadyBody = {};
  try {
    body = (await request.json()) as ReadyBody;
  } catch {
    body = {};
  }

  if (!body.playerId) {
    return new Response(JSON.stringify({ error: "MISSING_PLAYER_ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const player = setPlayerReady(session, body.playerId, Boolean(body.ready));
  if (!player) {
    return new Response(JSON.stringify({ error: "PLAYER_NOT_FOUND" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  addSessionEvent(session, {
    kind: "player_ready",
    message: player.ready ? `${player.name} 已准备。` : `${player.name} 取消了准备。`,
    actorId: player.id,
    actorName: player.name
  });

  if (
    session.phase === "lobby" &&
    session.players.length > 0 &&
    session.players.every((member) => member.ready)
  ) {
    addSessionEvent(session, {
      kind: "system",
      message: "全员已准备，随时可以开始审汤。"
    });
  }

  await saveSession(env, session);

  const visibleSoup = toVisibleSoup(session.soupId);
  if (!visibleSoup) {
    return new Response(JSON.stringify({ error: "SOUP_NOT_FOUND" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify(buildSessionPayload(session, visibleSoup)), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
