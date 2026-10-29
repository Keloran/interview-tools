import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import {POST as createInterview} from "../../interview/route";

// A distinct write URL prevents older deployments from accepting unsafe retries.
export async function POST(request: NextRequest) {
  if (!await currentUser()) return NextResponse.json({message: "unauthorized"}, {status: 401});
  const body = await request.clone().json().catch(() => null);
  if (!body || typeof body.clientMutationId !== "string" || !body.clientMutationId) {
    return NextResponse.json({message: "An upload identity is required"}, {status: 400});
  }
  return createInterview(request);
}
