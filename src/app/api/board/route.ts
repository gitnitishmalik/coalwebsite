import { getPublished } from "@/lib/store";

export const revalidate = 300;

/** Public JSON of the published board — for integrations and spreadsheets. */
export async function GET() {
  const board = await getPublished();
  const { settings: _settings, ...publicBoard } = board;
  void _settings;
  return Response.json(
    { ...publicBoard, attribution: "Jakarta Coal Exchange · Sceats Coal Report", disclaimer: "Market information only — not investment advice." },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
