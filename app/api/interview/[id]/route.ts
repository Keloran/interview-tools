import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import type { $Enums } from "@/app/generated/prisma/client";
import { interviewSelect, toInterviewDto } from "@/lib/interviews";
import {reportError} from "@/lib/bugfixes";
import {parseDebrief} from "@/lib/debrief";
import {parseFeedback} from "@/lib/feedback";
import {offerDaySchema} from "@/lib/offers";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  const {id: idParam} = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  try {
    const interview = await prisma.interview.findFirst({
      where: { id, application: { user: { clerkId: user.id } } },
      select: interviewSelect,
    });

    if (!interview) return NextResponse.json({ message: "Not Found" }, { status: 404 });

    return NextResponse.json(toInterviewDto(interview));
  } catch (error) {
    reportError("GET /api/interview/[id] error", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  const {id: idParam} = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await request.json();

    const owned = await prisma.interview.findFirst({
      where: { id, application: { user: { clerkId: user.id } } },
      select: { id: true, application: {select: {userId: true}}, stage: {select: {stage: true}} },
    });
    if (!owned) return NextResponse.json({ message: "Not Found" }, { status: 404 });

    // Only allow a safe subset of fields to be updated via this endpoint for now
    // Extend as needed.
    const data: Prisma.InterviewUpdateInput = {};

    if (typeof body.outcome === "string") {
      data.outcome = body.outcome as $Enums.InterviewOutcome;
    }
    if (typeof body.notes === "string") {
      data.notes = body.notes;
    }
    if (typeof body.link === "string" || body.link === null) {
      data.link = body.link;
    }
    if (body.date) {
      const d = new Date(body.date);
      if (!isNaN(d.getTime())) data.date = d;
    }
    if (body.date === null) data.date = null;
    if (body.deadline) {
      const d = new Date(body.deadline);
      if (!isNaN(d.getTime())) data.deadline = d;
    }
    if (body.deadline === null) data.deadline = null;
    if (owned.stage?.stage.trim().toLowerCase() === "offer") {
      data.date = null;
      if (typeof body.deadline === "string") {
        const day = body.deadline.slice(0, 10);
        if (!offerDaySchema.safeParse(day).success || Number.isNaN(Date.parse(body.deadline))) return NextResponse.json({message: "Enter a valid respond-by date"}, {status: 400});
        data.deadline = new Date(`${day}T00:00:00.000Z`);
      }
    }
    if (Number.isInteger(body.durationMinutes) && body.durationMinutes >= 15 && body.durationMinutes <= 480) {
      data.durationMinutes = body.durationMinutes;
    }
    if (typeof body.interviewer === "string" || body.interviewer === null) {
      data.interviewer = body.interviewer;
    }
    if (typeof body.stageName === "string" && body.stageName.trim() && body.stageName.trim().length <= 100) {
      const stage = await prisma.stage.upsert({where: {stage: body.stageName.trim()}, create: {stage: body.stageName.trim()}, update: {}});
      data.stage = {connect: {id: stage.id}};
    }
    if (typeof body.stageMethodName === "string" && body.stageMethodName.trim() && body.stageMethodName.trim().length <= 100) {
      const method = await prisma.stageMethod.upsert({where: {method: body.stageMethodName.trim()}, create: {method: body.stageMethodName.trim()}, update: {}});
      data.stageMethod = {connect: {id: method.id}};
    }
    if (typeof body.stageId === "number") {
      data.stage = { connect: { id: body.stageId } };
    }
    if (typeof body.stageMethodId === "number") {
      data.stageMethod = { connect: { id: body.stageMethodId } };
    }
    const debrief = parseDebrief(body.debrief);
    if (debrief) {
      const {prepNotes, ...rest} = debrief;
      Object.assign(data, rest, {debriefedAt: new Date()}, "prepNotes" in body.debrief ? {prepNotes} : {});
    }
    const feedback = parseFeedback(body.feedback);
    if (feedback) Object.assign(data, feedback);
    // Application-level fields live on the parent application
    const application: Prisma.ApplicationUpdateWithoutInterviewsInput = {};
    if (typeof body.companyName === "string" && body.companyName.trim()) {
      const company = await prisma.company.upsert({
        where: {userId_name: {userId: owned.application.userId, name: body.companyName.trim()}},
        create: {userId: owned.application.userId, name: body.companyName.trim()}, update: {},
      });
      application.company = {connect: {id: company.id}};
    }
    if (typeof body.clientCompany === "string" || body.clientCompany === null) {
      application.clientCompany = body.clientCompany;
    }
    if (typeof body.jobTitle === "string" && body.jobTitle.trim()) {
      application.jobTitle = body.jobTitle.trim();
    }
    if (body.metadata && typeof body.metadata === "object" && "jobListing" in body.metadata) {
      application.jobPostingLink = body.metadata.jobListing || null;
    }
    if (Object.keys(application).length) data.application = { update: application };

    const updated = await prisma.interview.update({
      where: { id },
      data,
      select: interviewSelect,
    });

    return NextResponse.json(toInterviewDto(updated));
  } catch (error) {
    // Renaming into another of your applications (same company, title, date and client)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "You already have an application with that title at this company" }, { status: 409 });
    }
    reportError("PUT /api/interview/[id] error", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 })
  }

  const {id: idParam} = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await request.json()
    const { outcome } = body ?? {}

    // Verify the interview belongs to the user
    const interview = await prisma.interview.findFirst({
      where: {
        id: Number(id),
        application: { user: { clerkId: user.id } },
      },
    })

    if (!interview) {
      return NextResponse.json({ message: "Interview not found" }, { status: 404 })
    }

    // Update the interview
    const updated = await prisma.interview.update({
      where: { id: Number(id) },
      data: {outcome: outcome as $Enums.InterviewOutcome},
      select: {
        id: true,
        outcome: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    reportError("PATCH /api/interview/[id] error", error)
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 })
  }
}
