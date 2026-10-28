import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";

export async function PUT(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const {id} = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.sent !== "boolean") return NextResponse.json({message: "Choose whether this link was sent"}, {status: 400});
  const where = {id, application: {user: {clerkId: user.id}}};
  try {
    const link = await prisma.availabilityLink.findFirst({where, select: {id: true}});
    if (!link) return NextResponse.json({message: "Link not found"}, {status: 404});
    await prisma.availabilityLink.updateMany({where: {...where, ...(body.sent ? {sentAt: null} : {})}, data: {sentAt: body.sent ? new Date() : null}});
    return NextResponse.json({saved: true}, {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("PUT /api/availability/[id]/sent", error);
    return NextResponse.json({message: "Could not update the sent record"}, {status: 500});
  }
}
