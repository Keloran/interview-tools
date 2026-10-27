import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";
import {validateReplyDate} from "@/lib/companyInsights";

export async function PUT(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const {id: raw} = await params;
  const id = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id < 1 || id > 2147483647) return NextResponse.json({message: "Invalid application"}, {status: 400});
  let body: unknown;
  try {body = await request.json();} catch {return NextResponse.json({message: "Invalid request"}, {status: 400});}
  if (!body || typeof body !== "object" || !("firstResponseAt" in body)) return NextResponse.json({message: "Supply a first-reply date or null"}, {status: 400});
  try {
    const where = {id, user: {clerkId: user.id}};
    const application = await prisma.application.findFirst({where, select: {applicationDate: true}});
    if (!application) return NextResponse.json({message: "Application not found"}, {status: 404});
    const parsed = validateReplyDate(body.firstResponseAt, application.applicationDate);
    if (parsed.error) return NextResponse.json({message: parsed.error}, {status: 400});
    const result = await prisma.application.updateMany({where, data: {firstResponseAt: parsed.date}});
    if (!result.count) return NextResponse.json({message: "Application not found"}, {status: 404});
    return NextResponse.json({firstResponseAt: parsed.date}, {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("PUT /api/applications/[id]/first-response", error);
    return NextResponse.json({message: "Could not save the first-reply date"}, {status: 500});
  }
}
