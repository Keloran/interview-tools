import {NextRequest, NextResponse} from "next/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";

// Public: the booking page calls this from the browser when it opens. Link previews
// (Slack, LinkedIn, email) fetch the HTML but don't run scripts, so they aren't counted.
// ponytail: the owner opening their own link counts too; skip it if that turns out to muddy the numbers
export async function POST(_request: NextRequest, {params}: { params: Promise<{ id: string }> }) {
  const {id} = await params;
  try {
    const now = new Date();
    const updated = await prisma.availabilityLink.updateMany({
      where: {id},
      data: {viewCount: {increment: 1}, lastViewedAt: now},
    });
    if (updated.count === 0) return new NextResponse(null, {status: 404});
    await prisma.availabilityLink.updateMany({where: {id, firstViewedAt: null}, data: {firstViewedAt: now}});
    return new NextResponse(null, {status: 204});
  } catch (error) {
    reportError("POST /api/availability/[id]/view error", error);
    return new NextResponse(null, {status: 500});
  }
}
