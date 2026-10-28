import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {employerLinkSchema, employerLinkSelect, linkCommunityEmployer} from "@/lib/communityEmployer";
import {employerNameKey} from "@/lib/communityAggregation";
const headers = {"Cache-Control": "private, no-store"};
type Context = {params: Promise<{id: string}>};
const validId = (id: string) => /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0;
export async function GET(_request: NextRequest, {params}: Context) {
  const user = await currentUser(); if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const {id} = await params; if (!validId(id)) return NextResponse.json({message: "Invalid id"}, {status: 400});
  try {
    const app = await prisma.application.findFirst({where: {id: Number(id), user: {clerkId: user.id}}, select: employerLinkSelect});
    if (!app) return NextResponse.json({message: "Application not found"}, {status: 404, headers});
    const sourceName = app.clientCompany || app.company.name;
    return NextResponse.json({applicationId: app.id, sourceName, employer: app.communityEmployer, confirmed: !!app.communityEmployerId && !!app.communityEmployer && !!app.communityEmployerConfirmedAt && app.communityEmployerIdentity === employerNameKey(sourceName), requiresClient: app.viaRecruiter && !app.clientCompany?.trim()}, {headers});
  } catch {return NextResponse.json({message: "Could not load employer confirmation"}, {status: 503, headers});}
}
export async function PUT(request: NextRequest, {params}: Context) {
  const user = await currentUser(); if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const {id} = await params; if (!validId(id)) return NextResponse.json({message: "Invalid id"}, {status: 400});
  const input = employerLinkSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({message: "Confirm a reviewed employer or remove the link"}, {status: 400, headers});
  try {const result = await linkCommunityEmployer(user.id, Number(id), input.data.employerId); return NextResponse.json(result, {status: result.status, headers});}
  catch {return NextResponse.json({message: "Could not update employer confirmation"}, {status: 503, headers});}
}
