import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function GET() {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get or create user
    const user = await prisma.user.upsert({
      where: { clerkId: clerkUser.id },
      update: {},
      create: {
        clerkId: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        name: clerkUser.fullName,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return NextResponse.json({
      calendarUuid: user.calendarUuid,
      calendarUrl: `${baseUrl}/api/calendar/${user.calendarUuid}`,
    });
  } catch (error) {
    console.error("Error fetching calendar settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUser.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate new UUID
    const newUuid = randomUUID();

    // Update user with new UUID
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { calendarUuid: newUuid },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return NextResponse.json({
      calendarUuid: updatedUser.calendarUuid,
      calendarUrl: `${baseUrl}/api/calendar/${updatedUser.calendarUuid}`,
    });
  } catch (error) {
    console.error("Error regenerating calendar UUID:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}