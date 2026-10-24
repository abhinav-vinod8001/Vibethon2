import { json, route } from "@/server/http";
import { languageRegistry } from "@/server/translations";

export const runtime = "nodejs";

export async function GET() {
  return route(async () => json(await languageRegistry()));
}
