import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import {Prisma} from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";
import {storySchema} from "@/lib/stories";
import {storySelect, toStory} from "@/lib/storySelect";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  try {
    const stories = await prisma.story.findMany({where: {user: {clerkId: user.id}}, select: storySelect(user.id), orderBy: [{updated_at: "desc"}, {id: "desc"}]});
    return NextResponse.json(stories.map(toStory), {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("GET /api/stories", error);
    return NextResponse.json({message: "Could not load stories"}, {status: 500});
  }
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const body = await request.json().catch(() => null);
  const parsed = storySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({message: "Enter a title and valid story fields (up to 8,000 characters each and 12 tags)."}, {status: 400});
  const mutation = body?.clientMutationId;
  if (mutation != null && (typeof mutation !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(mutation))) return NextResponse.json({message: "Invalid upload identity"}, {status: 400});
  const mutationId: string | null = mutation == null ? null : mutation.toLowerCase();
  let userId: number | null = null;
  const receipt = async () => {
    if (userId == null || mutationId == null) return null;
    const saved = await prisma.storyCreateReceipt.findUnique({where: {userId_mutationId: {userId, mutationId}}, select: {story: {select: storySelect(user.id)}}});
    if (!saved) return null;
    return saved.story ? NextResponse.json(toStory(saved.story), {headers: {"Cache-Control": "private, no-store"}})
      : NextResponse.json({message: "The original story was deleted. This upload will not recreate it."}, {status: 410});
  };
  try {
    const dbUser = await prisma.user.upsert({where: {clerkId: user.id}, update: {}, create: {clerkId: user.id, email: user.emailAddresses?.[0]?.emailAddress ?? `${user.id}@example.com`}});
    userId = dbUser.id;
    const existing = await receipt();
    if (existing) return existing;
    const story = await prisma.story.create({data: {...parsed.data, userId: dbUser.id,
      createReceipt: mutationId ? {create: {userId: dbUser.id, mutationId}} : undefined}, select: storySelect(user.id)});
    return NextResponse.json(toStory(story), {status: 201, headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    if (mutationId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      try {const existing = await receipt(); if (existing) return existing;} catch (lookupError) {reportError("POST /api/stories receipt", lookupError);}
    }
    reportError("POST /api/stories", error);
    return NextResponse.json({message: "Could not save story"}, {status: 500});
  }
}
