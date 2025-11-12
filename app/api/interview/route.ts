import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {inferStageMethodName} from "@/lib/utils";
import { $Enums, Prisma } from "@/app/generated/prisma/client";

export async function POST(request: NextRequest) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      stage,
      companyName,
      clientCompany,
      jobTitle,
      jobPostingLink,
      date, // ISO string
      deadline, // ISO string for Technical Test
      interviewer,
      locationType, // "phone" | "link"
      interviewLink,
      notes,
    } = body ?? {}

    // Basic validations
    if (!stage || !companyName || !jobTitle) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }

    // Parse date/deadline
    let interviewDate: Date | null = null
    let deadlineDate: Date | null = null
    if (date) {
      const d = new Date(date)
      if (!isNaN(d.getTime())) interviewDate = d
    }
    if (deadline) {
      const d = new Date(deadline)
      if (!isNaN(d.getTime())) deadlineDate = d
    }

    // Fallbacks
    if (!interviewDate && !deadlineDate) {
      const now = new Date()
      now.setHours(9, 0, 0, 0)
      interviewDate = now
    }

    // Ensure DB user exists
    const dbUser = await prisma.user.upsert({
      where: { clerkId: user.id },
      create: {
        clerkId: user.id,
        email: user.emailAddresses?.[0]?.emailAddress ?? `${user.id}@example.com`,
        name: user.firstName ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : null,
      },
      update: {},
    })

    // Dev override: use userId 12 in development
    const effectiveUserId = dbUser.id

    // Company connect or create (unique per userId+name)
    const company = await prisma.company.upsert({
      where: { userId_name: { userId: effectiveUserId, name: companyName } },
      create: { name: companyName, userId: effectiveUserId },
      update: {},
    })

    // Stage connect or create by stage string
    const stageRecord = await prisma.stage.upsert({
      where: { stage },
      create: { stage },
      update: {},
    })

    // StageMethod inferred from locationType and/or meeting link
    const methodName = inferStageMethodName(locationType, interviewLink)

    // Case-insensitive lookup to match any existing record (e.g., "zoom" vs "Zoom")
    let stageMethod = await prisma.stageMethod.findFirst({
      where: {method: {equals: methodName, mode: Prisma.QueryMode.insensitive}},
      select: { id: true, method: true },
    })
    if (!stageMethod) {
      stageMethod = await prisma.stageMethod.create({ data: { method: methodName }, select: { id: true, method: true } })
    }

    // Compose metadata as a plain object, cast at use site to Prisma.InputJsonValue
    const metadata: Record<string, unknown> = {}
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    if (jobPostingLink) (metadata as any).jobListing = jobPostingLink
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    if (locationType === "phone") (metadata as any).location = "phone"
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    if (locationType === "link") (metadata as any).location = "link"

    // Set outcome based on stage
    const outcome = stage !== "Applied" ? "SCHEDULED" : "AWAITING_RESPONSE"

    const isTechnicalTest = String(stage).toLowerCase() === "technical test".toLowerCase()

    const created = await prisma.interview.create({
      data: {
        companyId: company.id,
        clientCompany: clientCompany || null,
        jobTitle,
        applicationDate: new Date(),
        interviewer: isTechnicalTest ? null : (interviewer || null),
        stageId: stageRecord.id,
        stageMethodId: stageMethod.id,
        userId: effectiveUserId,
        date: isTechnicalTest ? null : interviewDate,
        deadline: isTechnicalTest ? (deadlineDate ?? interviewDate) : null,
        outcome: outcome as $Enums.InterviewOutcome,
        notes: notes || null,
        metadata: Object.keys(metadata).length ? (metadata as Prisma.InputJsonValue) : undefined,
        link: isTechnicalTest ? null : (interviewLink || null),
      },
      select: {
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
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("POST /api/interview error", error)
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 })
  }
}