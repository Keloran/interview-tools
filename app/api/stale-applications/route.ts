import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";
import {closeStaleApplications} from "@/lib/closeStaleApplications";
import {closeStaleSchema, staleCandidates, staleDaysSchema, staleSelect} from "@/lib/staleApplications";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  try {
    const [settings, applications] = await Promise.all([
      prisma.user.findUnique({where: {clerkId: user.id}, select: {staleAfterDays: true}}),
      prisma.application.findMany({where: {user: {clerkId: user.id}}, select: staleSelect}),
    ]);
    const days = settings?.staleAfterDays ?? 60;
    const candidates = staleCandidates(applications, days);
    return NextResponse.json({days, total: candidates.length, candidates: candidates.slice(0, 500)}, {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("GET /api/stale-applications", error);
    return NextResponse.json({message: "Could not load stale applications"}, {status: 500});
  }
}
export async function PUT(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const body = await request.json().catch(() => null);
  const days = staleDaysSchema.safeParse(body?.days);
  if (!days.success) return NextResponse.json({message: "Choose a whole number of days from 1 to 3,650"}, {status: 400});
  try {
    await prisma.user.upsert({where: {clerkId: user.id}, update: {staleAfterDays: days.data}, create: {clerkId: user.id, email: user.emailAddresses?.[0]?.emailAddress ?? `${user.id}@example.com`, staleAfterDays: days.data}});
    return NextResponse.json({days: days.data}, {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("PUT /api/stale-applications", error);
    return NextResponse.json({message: "Could not save the stale threshold"}, {status: 500});
  }
}
export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const parsed = closeStaleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({message: "Select up to 500 applications, choose a valid threshold and confirm closure"}, {status: 400});
  const ids = [...new Set(parsed.data.ids)];
  try {
    const result = await closeStaleApplications(user.id, ids, parsed.data.days);
    return NextResponse.json(result, {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("POST /api/stale-applications", error);
    return NextResponse.json({message: "Could not close stale applications. Refresh the list before trying again."}, {status: 500});
  }
}
