import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";
import {applicationExportSelect, exportApplications, exportStories} from "@/lib/csvExport";
import {storySelect, toStory} from "@/lib/storySelect";

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const kind = request.nextUrl.searchParams.get("kind") ?? "applications";
  if (!["applications", "stories"].includes(kind)) return NextResponse.json({message: "Unknown export type"}, {status: 400});
  try {
    let csv: string;
    if (kind === "stories") {
      const stories = await prisma.story.findMany({where: {user: {clerkId: user.id}}, select: storySelect(user.id), orderBy: {id: "asc"}});
      csv = exportStories(stories.map(toStory));
    } else {
      const applications = await prisma.application.findMany({where: {user: {clerkId: user.id}}, select: applicationExportSelect, orderBy: {id: "asc"}});
      csv = exportApplications(applications);
    }
    return new NextResponse(csv, {headers: {"Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="interview-tools-${kind}.csv"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}});
  } catch (error) {
    reportError("GET /api/data/export", error);
    return NextResponse.json({message: "Could not export your data"}, {status: 500});
  }
}
