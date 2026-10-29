import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import {POST as createStory} from "@/app/api/stories/route";

// A distinct route prevents old servers from accepting unsafe create retries.
export async function POST(request: NextRequest) {
  if (!await currentUser()) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const body = await request.clone().json().catch(() => null);
  if (!body || typeof body.clientMutationId !== "string" || !body.clientMutationId) return NextResponse.json({message: "Supply an upload identity"}, {status: 400});
  return createStory(request);
}
