import { getTurtleSoupById } from "../../_shared/turtleSoups";
import { loadSession } from "../../_shared/sessions";

export const onRequest = async (context: any): Promise<Response> => {
  const { request, params, env } = context;
  const id = params?.id as string | undefined;

  if (!id) {
    return new Response(JSON.stringify({ error: "MISSING_ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (request.method !== "GET") {
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

