import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {inferStageMethodName} from "@/lib/utils";
import {interviewSelect, toInterviewDto} from "@/lib/interviews";
import { $Enums, Prisma } from "@/app/generated/prisma/client";
import {reportError} from "@/lib/bugfixes";
import {contactData, recruiterSchema} from "@/lib/recruiters";

// 15m-8h, default an hour
function validDuration(value: unknown): number {
  const minutes = Number(value)
  return Number.isInteger(minutes) && minutes >= 15 && minutes <= 480 ? minutes : 60
}

export async function POST(request: NextRequest) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const contact = recruiterSchema.safeParse(body);
    if (!contact.success) return NextResponse.json({message: contact.error.issues[0].message}, {status: 400});
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
      previousInterviewId, // progressing an existing application to its next stage
      durationMinutes,
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

    // Set outcome based on stage
    const outcome = stage !== "Applied" ? "SCHEDULED" : "AWAITING_RESPONSE"

    const isTechnicalTest = String(stage).toLowerCase() === "technical test".toLowerCase()

    // Next stage of an existing application, or a brand new application
    const previous = previousInterviewId
      ? await prisma.interview.findFirst({
          where: { id: Number(previousInterviewId), application: { userId: effectiveUserId } },
          select: { id: true, applicationId: true },
        })
      : null

    const created = await prisma.interview.create({
      data: {
        application: previous
          ? { connect: { id: previous.applicationId } }
          : {
              create: {
                userId: effectiveUserId,
                companyId: company.id,
                clientCompany: clientCompany || null,
                jobTitle,
                applicationDate: new Date(),
                jobPostingLink: jobPostingLink || null,
                ...contactData(contact.data),
                viaRecruiter: !!contact.data.viaRecruiter || !!clientCompany?.trim(),
              },
            },
        parent: previous ? { connect: { id: previous.id } } : undefined,
        interviewer: isTechnicalTest ? null : (interviewer || null),
        stage: { connect: { id: stageRecord.id } },
        stageMethod: { connect: { id: stageMethod.id } },
        date: isTechnicalTest ? null : interviewDate,
        deadline: isTechnicalTest ? (deadlineDate ?? interviewDate) : null,
        durationMinutes: validDuration(durationMinutes),
        outcome: outcome as $Enums.InterviewOutcome,
        notes: notes || null,
        link: isTechnicalTest ? null : (interviewLink || null),
      },
      select: interviewSelect,
    })

    return NextResponse.json(toInterviewDto(created), { status: 201 })
  } catch (error) {
    reportError("POST /api/interview error", error)
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 })
  }
}
