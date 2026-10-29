import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import {Prisma} from "@/app/generated/prisma/client";
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

    return NextResponse.json(due, {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("GET /api/follow-ups error", error);
    return NextResponse.json({message: "Internal Server Error"}, {status: 500});
  }
}

// Log that you've followed up on an application
export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "unauthorized"}, {status: 401});

  const body = await request.json().catch(() => null);
  const applicationId = body?.applicationId;
  if (!Number.isInteger(applicationId) || applicationId <= 0 || applicationId > 2147483647) return NextResponse.json({message: "applicationId is required"}, {status: 400});
  const mutation = body?.clientMutationId;
  if (mutation != null && (typeof mutation !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(mutation))) return NextResponse.json({message: "Invalid upload identity"}, {status: 400});
  const mutationId: string | null = mutation == null ? null : mutation.toLowerCase();
  let ownedId: number | null = null;
  const replay = async () => ownedId != null && mutationId != null
    ? prisma.followUp.findUnique({where: {applicationId_clientMutationId: {applicationId: ownedId, clientMutationId: mutationId}}, select: {id: true, sentAt: true}}) : null;
  try {
    const owned = await prisma.application.findFirst({where: {id: applicationId, user: {clerkId: user.id}}, select: {id: true}});
    if (!owned) return NextResponse.json({message: "Not Found"}, {status: 404});
    ownedId = owned.id;
    const existing = await replay();
    if (existing) return NextResponse.json(existing, {headers: {"Cache-Control": "private, no-store"}});
    const followUp = await prisma.followUp.create({data: {applicationId, ...(mutationId ? {clientMutationId: mutationId} : {})}, select: {id: true, sentAt: true}});
    return NextResponse.json(followUp, {status: 201, headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    if (mutationId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      try {const existing = await replay(); if (existing) return NextResponse.json(existing, {headers: {"Cache-Control": "private, no-store"}});} catch (lookupError) {reportError("POST /api/follow-ups replay", lookupError);}
    }
    reportError("POST /api/follow-ups error", error);
    return NextResponse.json({message: "Internal Server Error"}, {status: 500});
  }
}
