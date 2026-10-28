import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";
import {activityApplicationSelect, activitySchema, entrySelect} from "@/lib/activityLog";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  try {
    const [applications, entries] = await Promise.all([
      prisma.application.findMany({where: {user: {clerkId: user.id}}, select: activityApplicationSelect, orderBy: {id: "asc"}}),
      prisma.activityEntry.findMany({where: {user: {clerkId: user.id}}, select: entrySelect, orderBy: [{date: "asc"}, {id: "asc"}]}),
    ]);
    return NextResponse.json({applications, entries}, {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("GET /api/activity-log", error);
    return NextResponse.json({message: "Could not load your activity log"}, {status: 500});
  }
}
export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const body = await request.json().catch(() => null);
  const parsed = activitySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({message: parsed.error.issues[0].message}, {status: 400});
  try {
    const dbUser = await prisma.user.upsert({where: {clerkId: user.id}, update: {}, create: {clerkId: user.id, email: user.emailAddresses?.[0]?.emailAddress ?? `${user.id}@example.com`}});
    const entry = await prisma.activityEntry.create({data: {...parsed.data, date: new Date(`${parsed.data.date}T00:00:00.000Z`), userId: dbUser.id}, select: entrySelect});
    return NextResponse.json(entry, {status: 201, headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("POST /api/activity-log", error);
    return NextResponse.json({message: "Could not save your activity"}, {status: 500});
  }
}
