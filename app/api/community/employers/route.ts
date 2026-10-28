import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {employerNameKey} from "@/lib/communityAggregation";
import {employerPublicSelect} from "@/lib/communityEmployer";
export async function GET(request: NextRequest) {
  const user = await currentUser(); if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length > 100) return NextResponse.json({message: "Shorten the employer search"}, {status: 400});
  try {
    const result = await prisma.communityEmployer.findMany({where: {reviewedAt: {not: null}, suppressedAt: null, ...(q ? {OR: [{name: {contains: q, mode: "insensitive"}}, {domain: {contains: q, mode: "insensitive"}}, {aliases: {has: employerNameKey(q)}}]} : {})}, select: employerPublicSelect, take: 20, orderBy: [{name: "asc"}, {id: "asc"}]});
    return NextResponse.json(result, {headers: {"Cache-Control": "private, no-store"}});
  } catch {return NextResponse.json({message: "Could not load the reviewed employer catalog"}, {status: 503});}
}
