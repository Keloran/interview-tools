import {NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";
import {companyHistory, companyHistorySelect} from "@/lib/companyHistory";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  try {
    const companies = await prisma.company.findMany({where: {user: {clerkId: user.id}}, select: companyHistorySelect, orderBy: {name: "asc"}});
    return NextResponse.json(companyHistory(companies, Date.now(), true), {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("GET /api/report", error);
    return NextResponse.json({message: "Could not load your report"}, {status: 500});
  }
}
