import { getTurtleSoupById } from "../../_shared/turtleSoups";

export const onRequest = async (context: any): Promise<Response> => {
  const { request, params } = context;
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

  const soup = getTurtleSoupById(id);
  if (!soup) {
    return new Response(JSON.stringify({ error: "NOT_FOUND" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  const url = new URL(request.url);
  const includeTruth = url.searchParams.get("includeTruth") === "1";

  const payload = {
    id: soup.id,
    title: soup.title,
    opening: soup.opening,
    difficulty: soup.difficulty,
    tags: soup.tags,
    truth: includeTruth ? soup.truth : undefined
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

