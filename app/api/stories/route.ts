import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
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
  const parsed = storySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({message: "Enter a title and valid story fields (up to 8,000 characters each and 12 tags)."}, {status: 400});
  try {
    const dbUser = await prisma.user.upsert({where: {clerkId: user.id}, update: {}, create: {clerkId: user.id, email: user.emailAddresses?.[0]?.emailAddress ?? `${user.id}@example.com`}});
    const story = await prisma.story.create({data: {...parsed.data, userId: dbUser.id}, select: storySelect(user.id)});
    return NextResponse.json(toStory(story), {status: 201});
  } catch (error) {
    reportError("POST /api/stories", error);
    return NextResponse.json({message: "Could not save story"}, {status: 500});
  }
}
