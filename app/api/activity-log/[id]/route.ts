import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";
import {activitySchema} from "@/lib/activityLog";

type Context = {params: Promise<{id: string}>};
const validId = (raw: string) => /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) && Number(raw) > 0 && Number(raw) <= 2147483647;
export async function PUT(request: NextRequest, {params}: Context) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const {id: raw} = await params;
  if (!validId(raw)) return NextResponse.json({message: "Invalid activity"}, {status: 400});
  const parsed = activitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({message: parsed.error.issues[0].message}, {status: 400});
  try {
    const result = await prisma.activityEntry.updateMany({where: {id: Number(raw), user: {clerkId: user.id}}, data: {...parsed.data, date: new Date(`${parsed.data.date}T00:00:00.000Z`)}});
    return NextResponse.json({saved: !!result.count}, {status: result.count ? 200 : 404});
  } catch (error) {
    reportError("PUT /api/activity-log/[id]", error);
    return NextResponse.json({message: "Could not save your activity"}, {status: 500});
  }
}
export async function DELETE(_request: NextRequest, {params}: Context) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const {id: raw} = await params;
  if (!validId(raw)) return NextResponse.json({message: "Invalid activity"}, {status: 400});
  try {
    const result = await prisma.activityEntry.deleteMany({where: {id: Number(raw), user: {clerkId: user.id}}});
    return result.count ? new NextResponse(null, {status: 204}) : NextResponse.json({message: "Activity not found"}, {status: 404});
  } catch (error) {
    reportError("DELETE /api/activity-log/[id]", error);
    return NextResponse.json({message: "Could not delete your activity"}, {status: 500});
  }
}
