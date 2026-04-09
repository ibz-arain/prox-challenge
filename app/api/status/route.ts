import { loadStatus } from "@/lib/ingest/indexer";

export async function GET() {
  const status = loadStatus();
  return Response.json(status);
}
