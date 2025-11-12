import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import type { $Enums } from "@/app/generated/prisma/client";

// Shared select shape to keep responses consistent with /api/interviews
const select = {
  id: true,
  jobTitle: true,
  interviewer: true,
  company: { select: { id: true, name: true } },
  clientCompany: true,
  stage: { select: { id: true, stage: true } },
  stageMethod: { select: { id: true, method: true } },
  applicationDate: true,
  date: true,
  deadline: true,
  outcome: true,
  notes: true,
  metadata: true,
  link: true,
} as const;

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
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
      where: { id, user: { clerkId: user.id } },
      select,
    });

    if (!interview) return NextResponse.json({ message: "Not Found" }, { status: 404 });

    return NextResponse.json(interview);
  } catch (error) {
    console.error("GET /api/interview/[id] error", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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

    const updated = await prisma.interview.update({
      where: { id },
      data,
      select,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/interview/[id] error", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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
        user: { clerkId: user.id },
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
