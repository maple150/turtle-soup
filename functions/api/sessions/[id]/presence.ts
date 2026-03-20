import { getTurtleSoupById } from "../../../_shared/turtleSoups";
import {
  buildSessionPayload,
  ensurePlayer,
  loadSession,
  saveSession,
  touchPlayer,
  type VisibleSoup
} from "../../../_shared/sessions";

interface PresenceBody {
  playerId?: string;
  playerName?: string;
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

  let body: PresenceBody = {};
  try {
    body = (await request.json()) as PresenceBody;
  } catch {
    body = {};
  }

  if (!body.playerId) {
    return new Response(JSON.stringify({ error: "MISSING_PLAYER_ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const touched = touchPlayer(session, body.playerId);
  if (!touched && body.playerName) {
    ensurePlayer(session, { id: body.playerId, name: body.playerName });
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
