import {NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import {reportError} from "@/lib/bugfixes";
import {loadCompanyHistory} from "@/lib/companyHistory";
import {recruiterRecords, recruiterStats} from "@/lib/recruiters";

// Each agency, and each recruiter at it, with their record: roles, replies, ghosting and feedback
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  try {
    const records = recruiterRecords(await loadCompanyHistory(user.id));
    return NextResponse.json(records.map((record) => ({...record, stats: recruiterStats(record.applications)})), {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("GET /api/recruiters", error);
    return NextResponse.json({message: "Could not load recruiters"}, {status: 500});
  }
}
