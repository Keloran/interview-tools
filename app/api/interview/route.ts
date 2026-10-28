import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {inferStageMethodName} from "@/lib/utils";
import {interviewSelect, toInterviewDto} from "@/lib/interviews";
import { $Enums, Prisma } from "@/app/generated/prisma/client";
import {reportError} from "@/lib/bugfixes";
import {contactData, recruiterSchema} from "@/lib/recruiters";
import {compensationSchema, cleanCompensation} from "@/lib/compensation";
import {offerDaySchema} from "@/lib/offers";

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
      offerDeadline,
      stageMethodId,
    } = body ?? {}

    // Basic validations
    if (!stage || !companyName || !jobTitle) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }
    const isOffer = String(stage).trim().toLowerCase() === "offer";
    if (isOffer && offerDeadline != null && offerDeadline !== "" && !offerDaySchema.safeParse(offerDeadline).success) return NextResponse.json({message: "Enter a valid respond-by date"}, {status: 400});

    const compensation = compensationSchema.safeParse({advertisedSalary: body.advertisedSalary ?? null});
    if (!compensation.success) return NextResponse.json({message: compensation.error.issues[0].message}, {status: 400});

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

    const previousId = previousInterviewId == null ? null : Number(previousInterviewId);
    if (previousId !== null && (!Number.isSafeInteger(previousId) || previousId <= 0 || previousId > 2147483647)) {
      return NextResponse.json({message: "Invalid previous interview"}, {status: 400});
    }
    if (stageMethodId != null && (!Number.isSafeInteger(stageMethodId) || stageMethodId <= 0 || stageMethodId > 2147483647)) {
      return NextResponse.json({message: "Invalid meeting method"}, {status: 400});
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

    // A missing or unowned parent must never silently create another application.
    const previous = previousId !== null
      ? await prisma.interview.findFirst({
          where: {id: previousId, application: {userId: effectiveUserId}},
          select: {id: true, applicationId: true},
        })
      : null;
    if (previousId !== null && !previous) {
      return NextResponse.json({message: "Previous interview not found"}, {status: 404});
    }
    const selectedMethod = stageMethodId != null && !isOffer
      ? await prisma.stageMethod.findFirst({where: {id: stageMethodId}, select: {id: true, method: true}})
      : null;
    if (stageMethodId != null && !isOffer && !selectedMethod) {
      return NextResponse.json({message: "Meeting method not found"}, {status: 404});
    }

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
    const methodName = isOffer ? "Not recorded" : inferStageMethodName(locationType, interviewLink)

    // Case-insensitive lookup to match any existing record (e.g., "zoom" vs "Zoom")
    let stageMethod = selectedMethod ?? await prisma.stageMethod.findFirst({
      where: {method: {equals: methodName, mode: Prisma.QueryMode.insensitive}},
      select: { id: true, method: true },
    })
    if (!stageMethod) {
      stageMethod = await prisma.stageMethod.create({ data: { method: methodName }, select: { id: true, method: true } })
    }

    // Set outcome based on stage
    const outcome = isOffer ? "OFFER_RECEIVED" : stage !== "Applied" ? "SCHEDULED" : "AWAITING_RESPONSE"

    const isTechnicalTest = String(stage).toLowerCase() === "technical test".toLowerCase()

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
                advertisedSalary: cleanCompensation(compensation.data).advertisedSalary,
                jobPostingLink: jobPostingLink || null,
                ...contactData(contact.data),
                viaRecruiter: !!contact.data.viaRecruiter || !!clientCompany?.trim(),
              },
            },
        parent: previous ? { connect: { id: previous.id } } : undefined,
        interviewer: isTechnicalTest || isOffer ? null : (interviewer || null),
        stage: { connect: { id: stageRecord.id } },
        stageMethod: { connect: { id: stageMethod.id } },
        date: isTechnicalTest || isOffer ? null : interviewDate,
        deadline: isOffer ? (offerDeadline ? new Date(`${offerDeadline}T00:00:00.000Z`) : null) : isTechnicalTest ? (deadlineDate ?? interviewDate) : null,
        durationMinutes: validDuration(durationMinutes),
        outcome: outcome as $Enums.InterviewOutcome,
        notes: notes || null,
        link: isTechnicalTest || isOffer ? null : (interviewLink || null),
      },
      select: interviewSelect,
    })

    return NextResponse.json(toInterviewDto(created), { status: 201 })
  } catch (error) {
    reportError("POST /api/interview error", error)
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 })
  }
}
