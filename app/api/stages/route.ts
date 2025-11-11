import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

export async function GET(_request: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  }

  try {
    const stages = await prisma.stage.findMany({
      select: { id: true, stage: true },
      orderBy: { stage: "asc" },
    });

    return NextResponse.json(stages);
  } catch (error) {
    console.error("GET /api/stages error", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
