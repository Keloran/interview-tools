import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";
import {timelineSelect} from "@/lib/timeline";

export async function GET(_request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const {id: raw} = await params;
  const id = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) return NextResponse.json({message: "Invalid application"}, {status: 400});
  try {
    const application = await prisma.application.findFirst({where: {id, user: {clerkId: user.id}}, select: timelineSelect});
    if (!application) return NextResponse.json({message: "Application not found"}, {status: 404});
    return NextResponse.json(application, {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("GET /api/applications/[id]/timeline", error);
    return NextResponse.json({message: "Could not load this application"}, {status: 500});
  }
}
