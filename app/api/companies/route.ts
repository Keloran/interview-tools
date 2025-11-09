import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let userId = user?.id;
  if (process.env.NODE_ENV !== "production") {
      userId = "user_35EzDSLP36fAaXr7eyWitgldgZy"
  }

  try {
    const companies = await prisma.company.findMany({
      where: { user: { clerkId: userId } },
      select: { name: true, id: true },
      orderBy: { name: "asc" },
    });

    // Return just an array of company names to match the client expectation
    return NextResponse.json(companies);
  } catch (err) {
    console.error("Error fetching companies: ", err);
    return NextResponse.json(
      { message: "Failed to fetch companies" },
      { status: 500 }
    );
  }
}