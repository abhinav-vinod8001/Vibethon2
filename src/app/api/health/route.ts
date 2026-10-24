import { getDatabase } from "@/server/database";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await (await getDatabase()).ready();
    return Response.json(
      { status: "ok", database: "ready" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable", database: "not-ready" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
