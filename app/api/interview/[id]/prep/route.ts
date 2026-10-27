import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";
import {prepSchema} from "@/lib/stories";

type Context = {params: Promise<{id: string}>};
export async function GET(_request: NextRequest, {params}: Context) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({message: "Invalid id"}, {status: 400});
  try {
    const stage = await prisma.interview.findFirst({where: {id, application: {user: {clerkId: user.id}}}, select: {prepNotes: true, stories: {where: {story: {user: {clerkId: user.id}}}, select: {storyId: true}}}});
    if (!stage) return NextResponse.json({message: "Not found"}, {status: 404});
    return NextResponse.json({notes: stage.prepNotes ?? "", storyIds: stage.stories.map((s) => s.storyId)}, {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("GET /api/interview/[id]/prep", error);
    return NextResponse.json({message: "Could not load preparation"}, {status: 500});
  }
}

export async function PUT(request: NextRequest, {params}: Context) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({message: "Invalid id"}, {status: 400});
  const parsed = prepSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({message: "Invalid preparation fields"}, {status: 400});
  try {
    const result = await prisma.$transaction(async (tx) => {
      const owned = await tx.interview.findFirst({where: {id, application: {user: {clerkId: user.id}}}, select: {id: true}});
      if (!owned) return false;
      const {notes, storyIds} = parsed.data;
      const stories = await tx.story.findMany({where: {id: {in: storyIds}, user: {clerkId: user.id}}, select: {id: true}});
      if (stories.length !== storyIds.length) return false;
      await tx.interview.update({where: {id}, data: {prepNotes: notes.trim() || null}});
      await tx.storyUse.deleteMany({where: {interviewId: id}});
      if (storyIds.length) await tx.storyUse.createMany({data: storyIds.map((storyId) => ({interviewId: id, storyId}))});
      return true;
    });
    return result ? NextResponse.json(parsed.data) : NextResponse.json({message: "Interview or story not found"}, {status: 404});
  } catch (error) {
    reportError("PUT /api/interview/[id]/prep", error);
    return NextResponse.json({message: "Could not save preparation"}, {status: 500});
  }
}
