import { currentUser } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)

    // Basic params
    const date = searchParams.get("date") // yyyy-mm-dd (filters to that day, UTC)
    const dateFrom = searchParams.get("dateFrom") // yyyy-mm-dd
    const dateTo = searchParams.get("dateTo") // yyyy-mm-dd
    const includePastParam = searchParams.get("includePast")

    // Entity filters
    const companyId = searchParams.get("companyId") // numeric string allowed
    const companyName = searchParams.get("company") // name contains (ci)
    const stageId = searchParams.get("stageId")
    const stageMethodId = searchParams.get("stageMethodId")

    // Multi-value enums
    // const statuses = searchParams.getAll("status") // e.g. status=SCHEDULED&status=COMPLETED
    const outcomes = searchParams.getAll("outcome")

    // Free-text search
    const q = searchParams.get("q")?.trim()

    // Pagination (safe defaults)
    const take = Math.min(Number(searchParams.get("take") ?? 100), 200)
    const skip = Math.max(Number(searchParams.get("skip") ?? 0), 0)

    // Default: when filtering by company, show all; otherwise show future only
    const includePast = includePastParam === null
      ? (!!companyName)
      : includePastParam === "true"

    // Shared select
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
    } as const

    // Build one dynamic where
    // Dev override: use userId 12 in development
    const where: any = { user: { clerkId: user.id } }

    // Date filters
    if (date) {
      const start = new Date(`${date}T00:00:00Z`)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      where.date = { gte: start, lt: end }
    } else if (dateFrom || dateTo) {
      const range: { gte?: Date; lte?: Date } = {}
      if (dateFrom) range.gte = new Date(`${dateFrom}T00:00:00Z`)
      if (dateTo) range.lte = new Date(`${dateTo}T23:59:59.999Z`)
      where.date = range
    } else if (!includePast) {
      // Show only future interviews
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      where.date = { gte: today }
    }

    // Company filters
    if (companyId) {
      // Your schema has companyId on Interview, so use the FK directly
      where.companyId = Number(companyId)
    } else if (companyName) {
      where.company = { name: { contains: companyName, mode: "insensitive" } }
    }

    // Stage filters
    if (stageId) where.stageId = Number(stageId)
    if (stageMethodId) where.stageMethodId = Number(stageMethodId)

    // Enum filters
    // status enum deprecated in favor of Stage table; ignore any status filters
    if (outcomes.length) where.outcome = { in: outcomes as any }

    // Free-text search across jobTitle, interviewer, company.name, and clientCompany
    if (q) {
      const or = [
        { jobTitle: { contains: q, mode: "insensitive" } },
        { interviewer: { contains: q, mode: "insensitive" } },
        { company: { name: { contains: q, mode: "insensitive" } } },
        { clientCompany: { contains: q, mode: "insensitive" } },
      ]
      where.AND = where.AND ? [...where.AND, { OR: or }] : [{ OR: or }]
    }

    const interviews = await prisma.interview.findMany({
      where,
      select,
      orderBy: { date: "asc" },
      take,
      skip,
    })

    return NextResponse.json(interviews)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 })
  }
}

// Infer StageMethod from locationType and meeting link
function inferStageMethodName(locationType?: string | null, interviewLink?: string | null): string {
  if (locationType === "phone") return "Phone";
  if (!interviewLink) return "Link";

  const candidates: { re: RegExp; name: string }[] = [
    { re: /zoom\.us|zoom\.com/i, name: "Zoom" },
    { re: /zoomgov\.com/i, name: "ZoomGov" },
    { re: /teams\.microsoft\.com|microsoft\.teams|live\.com\/meet/i, name: "Teams" },
    { re: /meet\.google\.com|hangouts\.google\.com|google\.com\/hangouts|workspace\.google\.com\/products\/meet/i, name: "Google Meet" },
    { re: /webex\.com|webex/i, name: "Webex" },
    { re: /skype\.com/i, name: "Skype" },
    { re: /bluejeans\.com/i, name: "BlueJeans" },
    { re: /whereby\.com/i, name: "Whereby" },
    { re: /jitsi\.org|meet\.jit\.si/i, name: "Jitsi" },
    { re: /gotomeet|gotowebinar|goto\.com/i, name: "GoToMeeting" },
    { re: /chime\.aws|amazonchime\.com/i, name: "Amazon Chime" },
    { re: /slack\.com/i, name: "Slack" },
    { re: /discord\.(gg|com)/i, name: "Discord" },
    { re: /facetime|apple\.com\/facetime/i, name: "FaceTime" },
    { re: /whatsapp\.com/i, name: "WhatsApp" },
    { re: /(^|\.)8x8\.vc/i, name: "8x8" },
    { re: /telegram\.(me|org)|(^|\/)t\.me\//i, name: "Telegram" },
    { re: /signal\.org/i, name: "Signal" },
  ];

  const raw = String(interviewLink);
  let host = "";
  try {
    host = new URL(raw).hostname;
  } catch {
    try {
      host = new URL(`https://${raw}`).hostname;
    } catch {
      host = "";
    }
  }
  const normalizedHost = host.replace(/^www\./i, "");

  const match = candidates.find((c) => c.re.test(normalizedHost) || c.re.test(raw));
  return match ? match.name : "Link";
}

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
      interviewer,
      locationType, // "phone" | "link"
      interviewLink,
    } = body ?? {}

    // Basic validations
    if (!stage || !companyName || !jobTitle) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }

    // Parse date
    let interviewDate: Date | null = null
    if (date) {
      const d = new Date(date)
      if (!isNaN(d.getTime())) interviewDate = d
    }

    // Fallback to today at 09:00 if not provided
    if (!interviewDate) {
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
      where: { method: { equals: methodName, mode: "insensitive" } },
      select: { id: true, method: true },
    })
    if (!stageMethod) {
      stageMethod = await prisma.stageMethod.create({ data: { method: methodName }, select: { id: true, method: true } })
    }

    // Compose metadata
    const metadata: Record<string, any> = {}
    if (jobPostingLink) metadata.jobListing = jobPostingLink
    if (locationType === "phone") metadata.location = "phone"
    if (locationType === "link") metadata.location = "link"

    const created = await prisma.interview.create({
      data: {
        companyId: company.id,
        clientCompany: clientCompany || null,
        jobTitle,
        applicationDate: new Date(),
        interviewer: interviewer || null,
        stageId: stageRecord.id,
        stageMethodId: stageMethod.id,
        userId: effectiveUserId,
        date: interviewDate,
        deadline: null,
        notes: null,
        metadata: Object.keys(metadata).length ? metadata : undefined,
        link: interviewLink || null,
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
    console.error("POST /api/interviews error", error)
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 })
  }
}