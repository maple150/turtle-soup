import { getTurtleSoupById } from "../../../_shared/turtleSoups";
import {
  addHistoryTurn,
  addSessionEvent,
  buildSessionPayload,
  ensurePlayer,
  loadSession,
  saveSession,
  type VisibleSoup
} from "../../../_shared/sessions";

interface JoinBody {
  id?: string;
  name?: string;
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

  let body: JoinBody = {};
  try {
    body = (await request.json()) as JoinBody;
  } catch {
    body = {};
  }

  const { player, joined } = ensurePlayer(session, body);
  if (joined) {
    addSessionEvent(session, {
      kind: "player_joined",
      message: `${player.name} 加入了房间。`,
      actorId: player.id,
      actorName: player.name
    });
    addHistoryTurn(session, {
      role: "system",
      kind: "system",
      content: `${player.name} 已入座，房间的推理气压又升高了一点。`,
      playerId: player.id,
      playerName: player.name
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
