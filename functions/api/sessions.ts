import { turtleSoups, getTurtleSoupById } from "../_shared/turtleSoups";
import {
  addHistoryTurn,
  addSessionEvent,
  buildSessionPayload,
  createEmptySession,
  createRecordId,
  ensurePlayer,
  saveSession,
  type VisibleSoup
} from "../_shared/sessions";

interface PlayerBody {
  id?: string;
  name?: string;
}

interface CreateSessionBody {
  soupId?: string;
  player?: PlayerBody;
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
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  let body: CreateSessionBody = {};
  try {
    body = (await request.json()) as CreateSessionBody;
  } catch {
    body = {};
  }

  const soup =
    (body.soupId ? getTurtleSoupById(body.soupId) : undefined) ??
    turtleSoups[Math.floor(Math.random() * turtleSoups.length)];

  if (!soup) {
    return new Response(JSON.stringify({ error: "NO_SOUP_AVAILABLE" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const session = createEmptySession(createRecordId("room"), soup.id);
  addHistoryTurn(session, {
    role: "assistant",
    kind: "system",
    content: `汤面已就位：《${soup.title}》。侦探们，开始拆解表象吧。`
  });
  addSessionEvent(session, {
    kind: "system",
    message: "房间已创建，等待侦探入座。"
  });

  if (body.player) {
    const { player } = ensurePlayer(session, body.player, { isHost: true });
    addSessionEvent(session, {
      kind: "player_joined",
      message: `${player.name} 创建了房间，成为本局房主。`,
      actorId: player.id,
      actorName: player.name
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
