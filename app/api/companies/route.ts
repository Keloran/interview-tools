import {NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";

export async function GET() {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({message: "Unauthorized"}, {status: 401});
  }

  return NextResponse.json({message: "Nope"}, {status: 500})
}