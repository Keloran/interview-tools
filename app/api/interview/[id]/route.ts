import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import type { $Enums } from "@/app/generated/prisma/client";
import { interviewSelect, toInterviewDto } from "@/lib/interviews";

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
    console.error("GET /api/interview/[id] error", error);
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
      select: { id: true },
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
    if (body.deadline) {
      const d = new Date(body.deadline);
      if (!isNaN(d.getTime())) data.deadline = d;
    }
    if (typeof body.interviewer === "string" || body.interviewer === null) {
      data.interviewer = body.interviewer;
    }
    if (typeof body.stageId === "number") {
      data.stage = { connect: { id: body.stageId } };
    }
    if (typeof body.stageMethodId === "number") {
      data.stageMethod = { connect: { id: body.stageMethodId } };
    }
    // Application-level fields live on the parent application
    const application: Prisma.ApplicationUpdateWithoutInterviewsInput = {};
    if (typeof body.clientCompany === "string" || body.clientCompany === null) {
      application.clientCompany = body.clientCompany;
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
    console.error("PUT /api/interview/[id] error", error);
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
    console.error("PATCH /api/interview/[id] error", error)
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 })
  }
}
