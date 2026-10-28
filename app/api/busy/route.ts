import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import {externalBusy} from "@/lib/externalBusy";

const MAX_RANGE_MS = 4 * 24 * 60 * 60 * 1000;

// Your busy times from a connected calendar ([] when none is connected); interviews come from /api/interviews
export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const from = new Date(request.nextUrl.searchParams.get("from") ?? "");
  const to = new Date(request.nextUrl.searchParams.get("to") ?? "");
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from || to.getTime() - from.getTime() > MAX_RANGE_MS) {
    return NextResponse.json({message: "Give a from and to no more than 4 days apart"}, {status: 400});
  }
  const busy = await externalBusy(user.id, from, to);
  return NextResponse.json(busy, {headers: {"Cache-Control": "private, no-store"}});
}
