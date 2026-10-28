import {NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";
import {offerApplicationSelect, openOffers} from "@/lib/offers";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  try {
    const applications = await prisma.application.findMany({where: {user: {clerkId: user.id}}, select: offerApplicationSelect});
    return NextResponse.json(openOffers(applications), {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("GET /api/offers", error);
    return NextResponse.json({message: "Could not load your offers"}, {status: 500});
  }
}
