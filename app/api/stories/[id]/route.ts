import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";
import {storySchema} from "@/lib/stories";

type Context = {params: Promise<{id: string}>};
export async function PUT(request: NextRequest, {params}: Context) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({message: "Invalid id"}, {status: 400});
  const parsed = storySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({message: "Invalid story fields"}, {status: 400});
  try {
    const result = await prisma.story.updateMany({where: {id, user: {clerkId: user.id}}, data: parsed.data});
    return result.count ? NextResponse.json({ok: true}) : NextResponse.json({message: "Not found"}, {status: 404});
  } catch (error) {
    reportError("PUT /api/stories/[id]", error);
    return NextResponse.json({message: "Could not save story"}, {status: 500});
  }
}

export async function DELETE(_request: NextRequest, {params}: Context) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({message: "Invalid id"}, {status: 400});
  try {
    const result = await prisma.story.deleteMany({where: {id, user: {clerkId: user.id}}});
    return result.count ? new NextResponse(null, {status: 204}) : NextResponse.json({message: "Not found"}, {status: 404});
  } catch (error) {
    reportError("DELETE /api/stories/[id]", error);
    return NextResponse.json({message: "Could not delete story"}, {status: 500});
  }
}
