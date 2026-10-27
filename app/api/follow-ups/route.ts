import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";
import {followUpDueAt} from "@/lib/followUps";

// Applications due a follow-up, oldest first
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "unauthorized"}, {status: 401});

  try {
    const applications = await prisma.application.findMany({
      where: {user: {clerkId: user.id}},
      select: {
        id: true,
        jobTitle: true,
        clientCompany: true,
        applicationDate: true,
        company: {select: {name: true}},
        interviews: {
          select: {outcome: true, date: true, replyBy: true, interviewer: true, nextStep: true, stage: {select: {stage: true}}},
          orderBy: {created_at: "desc"},
          take: 1,
        },
        followUps: {select: {sentAt: true}, orderBy: {sentAt: "desc"}},
      },
    });

    const now = Date.now();
    const due = applications
      .map(({interviews: [latest], followUps, company, ...a}) => {
        if (!latest) return null;
        const dueAt = followUpDueAt({
          applicationDate: a.applicationDate,
          latest: {stage: latest.stage.stage, outcome: latest.outcome, date: latest.date, replyBy: latest.replyBy},
          followUps: followUps.map((f) => f.sentAt),
        }, now);
        if (!dueAt || dueAt.getTime() > now) return null;
        return {
          ...a,
          company: company.name,
          stage: latest.stage.stage,
          interviewer: latest.interviewer,
          date: latest.date,
          nextStep: latest.nextStep,
          replyBy: latest.replyBy,
          followUps: followUps.length,
          lastFollowUp: followUps[0]?.sentAt ?? null,
          dueAt,
        };
      })
      .filter((a) => a !== null)
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

    return NextResponse.json(due);
  } catch (error) {
    reportError("GET /api/follow-ups error", error);
    return NextResponse.json({message: "Internal Server Error"}, {status: 500});
  }
}

// Log that you've followed up on an application
export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "unauthorized"}, {status: 401});

  try {
    const {applicationId} = await request.json();
    if (!Number.isInteger(applicationId)) return NextResponse.json({message: "applicationId is required"}, {status: 400});

    const owned = await prisma.application.findFirst({where: {id: applicationId, user: {clerkId: user.id}}, select: {id: true}});
    if (!owned) return NextResponse.json({message: "Not Found"}, {status: 404});

    const followUp = await prisma.followUp.create({data: {applicationId}, select: {id: true, sentAt: true}});
    return NextResponse.json(followUp, {status: 201});
  } catch (error) {
    reportError("POST /api/follow-ups error", error);
    return NextResponse.json({message: "Internal Server Error"}, {status: 500});
  }
}
