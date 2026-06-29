import { createAPIFileRoute } from "@tanstack/react-start/api";
import { handleCollect, type CollectEnv } from "@/lib/analytics-collect";

// POST /api/collect — receives the client beacon, inserts the pageview server-side
// (service role). GET is rejected. Secrets come from process.env at the edge.
export const APIRoute = createAPIFileRoute("/api/collect")({
  POST: ({ request }) => handleCollect(request, process.env as unknown as CollectEnv),
  GET: () => new Response(null, { status: 405 }),
});
