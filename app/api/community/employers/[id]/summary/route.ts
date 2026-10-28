import {NextRequest, NextResponse} from "next/server";
import {z} from "zod";
import {communitySummarySchema} from "@/lib/communityAggregation";
import {readCommunitySummary} from "@/lib/communityJob";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff"};
export async function GET(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  if (request.nextUrl.searchParams.size) return NextResponse.json({message: "Community summaries have no filters"}, {status: 400, headers});
  const {id} = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({summary: null}, {headers});
  try {const parsed = communitySummarySchema.safeParse(await readCommunitySummary(id)); return NextResponse.json({summary: parsed.success ? parsed.data : null}, {headers});}
  catch {return NextResponse.json({message: "Community summary unavailable"}, {status: 503, headers});}
}
