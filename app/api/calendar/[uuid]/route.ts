import {NextRequest, NextResponse} from "next/server";
import prisma from "@/lib/prisma";
import {interviewSelect, toInterviewDto} from "@/lib/interviews";
import {reportError} from "@/lib/bugfixes";
import {offerApplicationSelect, openOffers} from "@/lib/offers";
import {calendarFeed} from "@/lib/calendarFeed";

export async function GET(_request: NextRequest, {params}: {params: Promise<{uuid: string}>}) {
  try {
    const {uuid} = await params;
    const user = await prisma.user.findUnique({where: {calendarUuid: uuid}, select: {id: true}});
    if (!user) return new NextResponse("Calendar not found", {status: 404});
    const applications = await prisma.application.findMany({where: {userId: user.id}, select: offerApplicationSelect});
    const offerIds = openOffers(applications).map((offer) => offer.interviewId);
    const interviews = await prisma.interview.findMany({where: {
      application: {userId: user.id},
      AND: [{OR: [{outcome: "SCHEDULED", NOT: {stage: {stage: {equals: "Offer", mode: "insensitive"}}}}, {id: {in: offerIds}, deadline: {not: null}}]}, {OR: [{date: {not: null}}, {deadline: {not: null}}]}],
    }, select: interviewSelect, orderBy: [{date: "asc"}, {deadline: "asc"}]});
    return new NextResponse(calendarFeed(interviews.map(toInterviewDto)), {headers: {
      "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="interviews.ics"', "Cache-Control": "no-cache, no-store, must-revalidate",
    }});
  } catch (error) {
    reportError("Error generating calendar:", error);
    return new NextResponse("Internal server error", {status: 500});
  }
}
