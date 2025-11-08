import { currentUser } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
// import type { Prisma } from "@prisma/client" // optional strict typing for `where`

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
    const includePast = searchParams.get("includePast") === "true"

    // Entity filters
    const companyId = searchParams.get("companyId") // numeric string allowed
    const companyName = searchParams.get("company") // name contains (ci)
    const stageId = searchParams.get("stageId")
    const stageMethodId = searchParams.get("stageMethodId")

    // Multi-value enums
    const statuses = searchParams.getAll("status") // e.g. status=SCHEDULED&status=COMPLETED
    const outcomes = searchParams.getAll("outcome")

    // Free-text search
    const q = searchParams.get("q")?.trim()

    // Pagination (safe defaults)
    const take = Math.min(Number(searchParams.get("take") ?? 100), 200)
    const skip = Math.max(Number(searchParams.get("skip") ?? 0), 0)

    // Shared select
    const select = {
      id: true,
      jobTitle: true,
      interviewer: true,
      company: { select: { id: true, name: true } },
      stage: { select: { id: true, stage: true } },
      stageMethod: { select: { id: true, method: true } },
      applicationDate: true,
      date: true,
      deadline: true,
      status: true,
      outcome: true,
      notes: true,
      metadata: true,
      link: true,
    } as const

    // Build one dynamic where
    const where: any /* Prisma.InterviewWhereInput */ = {
      user: { clerkId: user.id },
    }

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
    if (statuses.length) where.status = { in: statuses }
    if (outcomes.length) where.outcome = { in: outcomes as any }

    // Free-text search across jobTitle, interviewer, and company.name
    if (q) {
      const or = [
        { jobTitle: { contains: q, mode: "insensitive" } },
        { interviewer: { contains: q, mode: "insensitive" } },
        { company: { name: { contains: q, mode: "insensitive" } } },
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