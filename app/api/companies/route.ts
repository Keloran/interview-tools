import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { CompanyHistory, summarizeApplication } from "@/lib/applications";

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
              select: { outcome: true, updated_at: true, stage: { select: { stage: true } } },
              orderBy: { created_at: "desc" },
            },
          },
          orderBy: { applicationDate: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });

    const history: CompanyHistory[] = companies.map((c) => ({
      id: c.id,
      name: c.name,
      applications: c.applications.map(({ interviews, ...a }) => ({
        ...a,
        ...summarizeApplication(interviews.map((i) => ({ stage: i.stage.stage, outcome: i.outcome, updatedAt: i.updated_at }))),
      })),
    }));

    return NextResponse.json(history);
  } catch (err) {
    console.error("Error fetching companies: ", err);
    return NextResponse.json(
      { message: "Failed to fetch companies" },
      { status: 500 }
    );
  }
}