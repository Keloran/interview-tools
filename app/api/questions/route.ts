import {NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";
import {questionEntries} from "@/lib/questions";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  try {
    const rows = await prisma.interview.findMany({
      where: {application: {user: {clerkId: user.id}}, questionsAsked: {not: null}},
      select: {id: true, date: true, debriefedAt: true, created_at: true, questionsAsked: true, debriefNotes: true,
        stage: {select: {stage: true}},
        application: {select: {jobTitle: true, clientCompany: true, company: {select: {name: true}}}}},
    });
    return NextResponse.json(questionEntries(rows), {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("GET /api/questions", error);
    return NextResponse.json({message: "Could not load questions"}, {status: 500});
  }
}
