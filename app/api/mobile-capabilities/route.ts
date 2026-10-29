import {NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";

export async function GET() {
  if (!await currentUser()) return NextResponse.json({message: "unauthorized"}, {status: 401});
  return NextResponse.json({interviewCreateIdempotency: 1});
}
