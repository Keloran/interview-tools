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
    return NextResponse.json(companyHistory(companies), {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("Error fetching companies: ", error);
    return NextResponse.json({message: "Failed to fetch companies"}, {status: 500});
  }
}
