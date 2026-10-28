import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {cleanCompensation, compensationSchema, compensationSelect, offerDetailKeys} from "@/lib/compensation";
import {reportError} from "@/lib/bugfixes";

const headers = {"Cache-Control": "private, no-store"};
type Context = {params: Promise<{id: string}>};
const validId = (id: string) => /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0;
export async function GET(_request: NextRequest, {params}: Context) {
  const user = await currentUser(); if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const {id} = await params; if (!validId(id)) return NextResponse.json({message: "Invalid id"}, {status: 400});
  try {
    const row = await prisma.interview.findFirst({where: {id: Number(id), application: {user: {clerkId: user.id}}}, select: {...compensationSelect, stage: {select: {stage: true}}, application: {select: {advertisedSalary: true}}}});
    if (!row) return NextResponse.json({message: "Not found"}, {status: 404});
    const {application, stage, ...details} = row;
    return NextResponse.json({...details, advertisedSalary: application.advertisedSalary, isOffer: stage.stage.trim().toLowerCase() === "offer"}, {headers});
  } catch (error) {reportError("GET /api/interview/[id]/compensation", error); return NextResponse.json({message: "Could not load salary details"}, {status: 500});}
}
export async function PUT(request: NextRequest, {params}: Context) {
  const user = await currentUser(); if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const {id} = await params; if (!validId(id)) return NextResponse.json({message: "Invalid id"}, {status: 400});
  try {
    const input = compensationSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({message: input.error.issues[0].message}, {status: 400});
    const row = await prisma.interview.findFirst({where: {id: Number(id), application: {user: {clerkId: user.id}}}, select: {id: true, applicationId: true, stage: {select: {stage: true}}}});
    if (!row) return NextResponse.json({message: "Not found"}, {status: 404});
    if (row.stage.stage.trim().toLowerCase() !== "offer" && offerDetailKeys.some((key) => input.data[key] !== undefined)) return NextResponse.json({message: "Offer details belong on an Offer stage"}, {status: 400});
    const {advertisedSalary, ...details} = cleanCompensation(input.data);
    await prisma.$transaction(async (tx) => {
      if (advertisedSalary !== undefined) await tx.application.updateMany({where: {id: row.applicationId, user: {clerkId: user.id}}, data: {advertisedSalary}});
      if (Object.keys(details).length) await tx.interview.updateMany({where: {id: row.id, application: {user: {clerkId: user.id}}}, data: details});
    });
    return NextResponse.json({saved: true}, {headers});
  } catch (error) {reportError("PUT /api/interview/[id]/compensation", error); return NextResponse.json({message: "Could not save salary details"}, {status: 500});}
}
