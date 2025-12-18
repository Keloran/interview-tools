import {currentUser} from "@clerk/nextjs/server"
import {NextRequest, NextResponse} from "next/server"
import prisma from "@/lib/prisma"
import type {$Enums} from "@/app/generated/prisma/client"
import {Prisma} from "@/app/generated/prisma/client"

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
    const take = Math.min(Number(searchParams.get("take") ?? 200), 2000)
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
    //const where : Prisma.InterviewWhereInput = { user: { id: 12 }}
    const where: Prisma.InterviewWhereInput = {user: {clerkId: user.id}}

    // Date filters (consider both scheduled date and deadline)
    if (date) {
      const start = new Date(`${date}T00:00:00Z`)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      where.OR = [
        {date: {gte: start, lt: end}},
        {deadline: {gte: start, lt: end}},
      ]
    } else if (dateFrom || dateTo) {
      const rangeDate: { gte?: Date; lte?: Date } = {}
      const rangeDeadline: { gte?: Date; lte?: Date } = {}
      if (dateFrom) {
        rangeDate.gte = new Date(`${dateFrom}T00:00:00Z`)
        rangeDeadline.gte = new Date(`${dateFrom}T00:00:00Z`)
      }
      if (dateTo) {
        rangeDate.lte = new Date(`${dateTo}T23:59:59.999Z`)
        rangeDeadline.lte = new Date(`${dateTo}T23:59:59.999Z`)
      }
      where.OR = [
        {date: rangeDate},
        {deadline: rangeDeadline},
      ]
    } else if (!includePast) {
      // Show only future interviews (scheduled date or deadline)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      where.OR = [
        {date: {gte: today}},
        {deadline: {gte: today}},
      ]
    }

    // Company filters
    if (companyId) {
      // Your schema has companyId on Interview, so use the FK directly
      where.companyId = Number(companyId)
    } else if (companyName) {
      // Search both company name and clientCompany field
      const companyOr = [
        {company: {name: {contains: companyName, mode: Prisma.QueryMode.insensitive}}},
        {clientCompany: {contains: companyName, mode: Prisma.QueryMode.insensitive}},
      ]
      const andArray = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : []
      where.AND = [...andArray, {OR: companyOr}]
    }

    // Stage filters
    if (stageId) where.stageId = Number(stageId)
    if (stageMethodId) where.stageMethodId = Number(stageMethodId)

    // Enum filters
    // status enum deprecated in favor of Stage table; ignore any status filters
    if (outcomes.length) where.outcome = {in: outcomes as unknown as $Enums.InterviewOutcome[]}

    // Free-text search across jobTitle, interviewer, company.name, and clientCompany
    if (q) {
      const or = [
        {jobTitle: {contains: q, mode: Prisma.QueryMode.insensitive}},
        {interviewer: {contains: q, mode: Prisma.QueryMode.insensitive}},
        {company: {name: {contains: q, mode: Prisma.QueryMode.insensitive}}},
        {clientCompany: {contains: q, mode: Prisma.QueryMode.insensitive}},
      ]
      const andArray = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : []
      where.AND = [...andArray, {OR: or}]
    }

    const interviews = await prisma.interview.findMany({
      where,
      select,
      orderBy: [
        {date: "asc"},
        {deadline: "asc"},
      ],
      take,
      skip,
    })

    return NextResponse.json(interviews)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 })
  }
}