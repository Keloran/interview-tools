import {NextRequest, NextResponse} from "next/server";
import {clerkClient, currentUser} from "@clerk/nextjs/server";
import {reportError} from "@/lib/bugfixes";
import prisma from "@/lib/prisma";
import {DELETE_CONFIRMATION} from "@/lib/account";

// Delete your data, then your login. Data first: if removing the login fails, retrying is safe.
export async function DELETE(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "unauthorized"}, {status: 401});

  const {confirm} = await request.json().catch(() => ({}));
  if (typeof confirm !== "string" || confirm.trim().toLowerCase() !== DELETE_CONFIRMATION) {
    return NextResponse.json({message: `Type "${DELETE_CONFIRMATION}" to confirm`}, {status: 400});
  }

  try {
    // Everything hangs off the user with ON DELETE CASCADE (companies, applications, stages, availability
    // links, follow-ups), so this one statement removes it all or nothing
    await prisma.user.deleteMany({where: {clerkId: user.id}});
  } catch (error) {
    reportError("DELETE /api/account: deleting data failed", error);
    return NextResponse.json({message: "Couldn't delete your data, nothing was removed. Please try again."}, {status: 500});
  }

  try {
    await (await clerkClient()).users.deleteUser(user.id);
  } catch (error) {
    reportError("DELETE /api/account: deleting the Clerk user failed", error);
    return NextResponse.json({message: "Your data is deleted, but your login couldn't be removed. Please try again."}, {status: 502});
  }

  return new NextResponse(null, {status: 204});
}
