import { turtleSoups } from "../_shared/turtleSoups";

export const onRequest = async (context: any): Promise<Response> => {
  const { request } = context;

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  const list = turtleSoups.map((t) => ({
    id: t.id,
    title: t.title,
    opening: t.opening,
    difficulty: t.difficulty,
    tags: t.tags
  }));

  return new Response(JSON.stringify(list), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

