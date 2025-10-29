import { NextResponse } from "next/server";
import { fetchTickets } from "@/lib/sql-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await fetchTickets();
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Tickets query failed", error);
    const message =
      error instanceof Error ? error.message : "Unable to retrieve tickets at this time.";
    const responseMessage =
      process.env.NODE_ENV === "production"
        ? "Unable to retrieve tickets at this time."
        : message;
    return NextResponse.json(
      { error: responseMessage },
      { status: 500 }
    );
  }
}
