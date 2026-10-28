import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";
import {activityApplicationSelect, activityCSV, activityRows, activityTotals, entrySelect} from "@/lib/activityLog";
import {defaultPeriod, reportPeriod} from "@/lib/searchReport";

// The activity log for a period, built here with the website's own rules so the apps show and export the same
// rows. ?format=csv returns the same CSV as the website's export.
// ponytail: days are in the server's timezone (UTC); see /api/report/summary
export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const params = new URL(request.url).searchParams;
  const fallback = defaultPeriod();
  const from = params.get("from") ?? fallback.from, through = params.get("through") ?? fallback.through;
  const period = reportPeriod(from, through);
  if (!period) return NextResponse.json({message: "Choose a valid period of up to 10 years"}, {status: 400});
  try {
    const [applications, entries] = await Promise.all([
      prisma.application.findMany({where: {user: {clerkId: user.id}}, select: activityApplicationSelect, orderBy: {id: "asc"}}),
      prisma.activityEntry.findMany({where: {user: {clerkId: user.id}}, select: entrySelect, orderBy: [{date: "asc"}, {id: "asc"}]}),
    ]);
    // Round-trip through JSON so dates are strings, exactly as the browser receives them
    const rows = activityRows(JSON.parse(JSON.stringify({applications, entries})), period);
    if (params.get("format") === "csv") {
      return new NextResponse(activityCSV(rows, from, through), {headers: {"Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="activity-log-${from}-to-${through}.csv"`, "Cache-Control": "private, no-store"}});
    }
    return NextResponse.json({from, through, totals: activityTotals(rows), rows}, {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("GET /api/activity-log/rows", error);
    return NextResponse.json({message: "Could not load your activity log"}, {status: 500});
  }
}
