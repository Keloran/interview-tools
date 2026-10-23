import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

const MAX_SLOTS = 20;

// Create a shareable availability link for the next stage of the application `interviewId` belongs to
export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({message: "unauthorized"}, {status: 401});
  }

  try {
    const {interviewId, stage, durationMinutes, slots, meetingLink} = (await request.json()) ?? {};

    const duration = Number(durationMinutes ?? 60);
    const dates = Array.isArray(slots) ? slots.map((s: unknown) => new Date(String(s))) : [];
    if (!stage || !Number.isInteger(duration) || duration < 15 || duration > 480) {
      return NextResponse.json({message: "Missing or invalid stage/duration"}, {status: 400});
    }
    if (!dates.length || dates.length > MAX_SLOTS || dates.some((d) => isNaN(d.getTime()) || d.getTime() <= Date.now())) {
      return NextResponse.json({message: `Provide 1-${MAX_SLOTS} future slots`}, {status: 400});
    }

    const interview = await prisma.interview.findFirst({
      where: {id: Number(interviewId), application: {user: {clerkId: user.id}}},
      select: {applicationId: true},
    });
    if (!interview) {
      return NextResponse.json({message: "Interview not found"}, {status: 404});
    }

    const stageRecord = await prisma.stage.upsert({where: {stage}, create: {stage}, update: {}});

    const link = await prisma.availabilityLink.create({
      data: {
        applicationId: interview.applicationId,
        stageId: stageRecord.id,
        durationMinutes: duration,
        meetingLink: meetingLink || null,
        slots: dates,
      },
      select: {id: true},
    });

    return NextResponse.json({id: link.id, path: `/availability/${link.id}`}, {status: 201});
  } catch (error) {
    console.error("POST /api/availability error", error);
    return NextResponse.json({message: "Internal Server Error"}, {status: 500});
  }
}
