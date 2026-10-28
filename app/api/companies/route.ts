import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { CompanyHistory, summarizeApplication } from "@/lib/applications";
import {reportError} from "@/lib/bugfixes";
import { brokenPromise } from "@/lib/followUps";
import {linkState} from "@/lib/availability";
import {sortStages} from "@/lib/stages";

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
            viaRecruiter: true,
            recruiterName: true,
            recruiterEmail: true,
            recruiterLinkedIn: true,
            jobTitle: true,
            clientCompany: true,
            applicationDate: true,
            firstResponseAt: true,
            jobPostingLink: true,
            interviews: {
              select: { outcome: true, updated_at: true, created_at: true, replyBy: true, feedbackType: true, stage: { select: { stage: true } } },
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
          interviews.map((i) => ({ stage: i.stage.stage, outcome: i.outcome, updatedAt: i.updated_at, feedbackType: i.feedbackType })),
          undefined,
          availabilityLinks,
          _count.followUps,
          a.firstResponseAt,
        ),
        furthestStage: sortStages(interviews.map((interview) => ({stage: interview.stage.stage}))).at(-1)?.stage ?? "Applied",
        ignoredLinks: (availabilityLinks ?? []).filter((link) => linkState(link) === "ignored").length,
        promise: brokenPromise(
          interviews.map((i) => ({ outcome: i.outcome, replyBy: i.replyBy, createdAt: i.created_at, updatedAt: i.updated_at })),
        ),
      })),
    }));

    return NextResponse.json(history, {headers: {"Cache-Control": "private, no-store"}});
  } catch (err) {
    reportError("Error fetching companies: ", err);
    return NextResponse.json(
      { message: "Failed to fetch companies" },
      { status: 500 }
    );
  }
}
