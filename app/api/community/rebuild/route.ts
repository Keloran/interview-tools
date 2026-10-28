import {timingSafeEqual} from "node:crypto";
import {NextRequest, NextResponse} from "next/server";
import {rebuildCommunity} from "@/lib/communityJob";
export async function POST(request: NextRequest) {
  const token = process.env.COMMUNITY_REBUILD_TOKEN;
  if (!token || token.length < 32) return NextResponse.json({message: "Not available"}, {status: 404});
  const supplied = request.headers.get("authorization") ?? "", expected = `Bearer ${token}`;
  if (Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  try {return NextResponse.json(await rebuildCommunity(), {headers: {"Cache-Control": "no-store"}});}
  catch {return NextResponse.json({message: "Community aggregation unavailable"}, {status: 503, headers: {"Cache-Control": "no-store"}});}
}
