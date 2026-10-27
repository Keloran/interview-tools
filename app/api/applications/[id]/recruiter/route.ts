import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";
import {contactData, recruiterSchema} from "@/lib/recruiters";

export async function PUT(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const {id: raw} = await params;
  const id = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id < 1 || id > 2147483647) return NextResponse.json({message: "Invalid application"}, {status: 400});
  let body: unknown;
  try {body = await request.json();} catch {return NextResponse.json({message: "Invalid request"}, {status: 400});}
  const parsed = recruiterSchema.safeParse(body);
  if (!parsed.success || parsed.data.viaRecruiter === undefined) return NextResponse.json({message: parsed.success ? "Choose whether this is via a recruiter" : parsed.error.issues[0].message}, {status: 400});
  try {
    const result = await prisma.application.updateMany({where: {id, user: {clerkId: user.id}}, data: contactData(parsed.data)});
    if (!result.count) return NextResponse.json({message: "Application not found"}, {status: 404});
    return NextResponse.json({saved: true}, {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("PUT /api/applications/[id]/recruiter", error);
    return NextResponse.json({message: "Could not save recruiter details"}, {status: 500});
  }
}
