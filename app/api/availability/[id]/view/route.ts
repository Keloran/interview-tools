import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";

// Public: the booking page calls this from the browser when it opens. Link previews
// (Slack, LinkedIn, email) fetch the HTML but don't run scripts, so they aren't counted.
// The owner opening their own link to check it isn't counted.
export async function POST(_request: NextRequest, {params}: { params: Promise<{ id: string }> }) {
  const {id} = await params;
  try {
    const user = await currentUser();
    if (user && await prisma.availabilityLink.findFirst({where: {id, application: {user: {clerkId: user.id}}}, select: {id: true}})) {
      return new NextResponse(null, {status: 204});
    }
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
