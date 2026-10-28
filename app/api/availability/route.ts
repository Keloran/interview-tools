import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";

const MAX_SLOTS = 20;

// The links sent for the application `interviewId` belongs to, newest first, with how far each got
export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({message: "unauthorized"}, {status: 401});
  }

  try {
    const interviewId = Number(new URL(request.url).searchParams.get("interviewId"));
    const interview = await prisma.interview.findFirst({
      where: {id: interviewId, application: {user: {clerkId: user.id}}},
      select: {
        application: {
          select: {
            jobTitle: true,
            clientCompany: true,
            company: {select: {name: true}},
            availabilityLinks: {
              select: {
                id: true,
                slots: true,
                durationMinutes: true,
                bookedSlot: true,
                viewCount: true,
                firstViewedAt: true,
                lastViewedAt: true,
                created_at: true,
                sentAt: true,
                stage: {select: {stage: true}},
              },
              orderBy: {created_at: "desc"},
            },
          },
        },
      },
    });
    if (!interview) {
      return NextResponse.json({message: "Interview not found"}, {status: 404});
    }

    const {application} = interview;
    return NextResponse.json({
      jobTitle: application.jobTitle,
      // via a recruiter, the role is at the client
      company: application.clientCompany || application.company.name,
      links: application.availabilityLinks.map(({stage, ...link}) => ({...link, stage: stage.stage, path: `/availability/${link.id}`})),
    });
  } catch (error) {
    reportError("GET /api/availability error", error);
    return NextResponse.json({message: "Internal Server Error"}, {status: 500});
  }
}

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
    reportError("POST /api/availability error", error);
    return NextResponse.json({message: "Internal Server Error"}, {status: 500});
  }
}
