import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";

export async function GET() {
  try {
    const stageMethods = await prisma.stageMethod.findMany({
      orderBy: { method: "asc" },
    });

    return NextResponse.json(stageMethods);
  } catch (error) {
    reportError("GET /api/stage-methods error", error);
    return NextResponse.json(
      { error: "Failed to fetch stage methods" },
      { status: 500 }
    );
  }
}