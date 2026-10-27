import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { CompanyHistory, summarizeApplication } from "@/lib/applications";
import {reportError} from "@/lib/bugfixes";
import { brokenPromise } from "@/lib/followUps";

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const companies = await prisma.company.findMany({
      where: { user: { clerkId: user.id } },
      select: {
        name: true,
        id: true,
        applications: {
          select: {
            id: true,
            jobTitle: true,
            clientCompany: true,
            applicationDate: true,
            interviews: {
              select: { outcome: true, updated_at: true, created_at: true, replyBy: true, stage: { select: { stage: true } } },
              orderBy: { created_at: "desc" },
            },
            availabilityLinks: { select: { created_at: true, viewCount: true, lastViewedAt: true, bookedSlot: true } },
            _count: { select: { followUps: true } },
          },
          orderBy: { applicationDate: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });

    const history: CompanyHistory[] = companies.map((c) => ({
      id: c.id,
      name: c.name,
      applications: c.applications.map(({ interviews, availabilityLinks, _count, ...a }) => ({
        ...a,
        ...summarizeApplication(
          interviews.map((i) => ({ stage: i.stage.stage, outcome: i.outcome, updatedAt: i.updated_at })),
          undefined,
          availabilityLinks,
          _count.followUps,
        ),
        promise: brokenPromise(
          interviews.map((i) => ({ outcome: i.outcome, replyBy: i.replyBy, createdAt: i.created_at, updatedAt: i.updated_at })),
        ),
      })),
    }));

    return NextResponse.json(history);
  } catch (err) {
    reportError("Error fetching companies: ", err);
    return NextResponse.json(
      { message: "Failed to fetch companies" },
      { status: 500 }
    );
  }
}