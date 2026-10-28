import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import {offerMutationSchema} from "@/lib/offers";
import {updateOffer} from "@/lib/updateOffer";
import {reportError} from "@/lib/bugfixes";

export async function PUT(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const {id: raw} = await params;
  const id = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id < 1 || id > 2147483647) return NextResponse.json({message: "Invalid offer"}, {status: 400});
  const parsed = offerMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({message: parsed.error.issues[0].message}, {status: 400});
  try {
    const result = await updateOffer(user.id, id, parsed.data);
    return NextResponse.json(result.status === 200 ? {saved: true} : {message: result.status === 404 ? "Offer not found" : "This offer changed or is no longer open. Refresh and try again."}, {status: result.status, headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("PUT /api/offers/[id]", error);
    return NextResponse.json({message: "Could not update your offer"}, {status: 500});
  }
}
