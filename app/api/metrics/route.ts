import { NextRequest, NextResponse } from "next/server";
import { globalMetrics } from "../../../lib/metrics/metrics-collector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = globalMetrics.getSnapshot();
  return NextResponse.json(snapshot);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.action === "reset") {
      globalMetrics.reset();
      return NextResponse.json({ success: true, message: "Metrics reset successfully" });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

