import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";
import {companyHistory, companyHistorySelect} from "@/lib/companyHistory";
import {defaultPeriod, reportPeriod, searchReport} from "@/lib/searchReport";

// The job-search report for the apps, worked out here with the website's own searchReport.
// ponytail: days are in the server's timezone (UTC), not the phone's; an activity within an hour of midnight
// can land on the neighbouring day. Pass an offset if that matters to anyone.
export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const params = new URL(request.url).searchParams;
  const fallback = defaultPeriod();
  const from = params.get("from") ?? fallback.from, through = params.get("through") ?? fallback.through;
  const period = reportPeriod(from, through);
  if (!period) return NextResponse.json({message: "Choose a valid period of up to 10 years"}, {status: 400});
  try {
    const companies = await prisma.company.findMany({where: {user: {clerkId: user.id}}, select: companyHistorySelect, orderBy: {name: "asc"}});
    return NextResponse.json({from, through, ...searchReport(companyHistory(companies, Date.now(), true), period)}, {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("GET /api/report/summary", error);
    return NextResponse.json({message: "Could not load your report"}, {status: 500});
  }
}
