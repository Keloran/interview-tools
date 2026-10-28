import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import {communityConsentState, grantCommunityConsent, withdrawCommunityConsent} from "@/lib/communityConsent";
import {consentMutationSchema} from "@/lib/communityPolicy";
import {reportError} from "@/lib/bugfixes";

const headers = {"Cache-Control": "private, no-store"};
export async function GET() {
  const user = await currentUser(); if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  try {return NextResponse.json(await communityConsentState(user.id, !!user.emailAddresses?.some((email) => email.verification?.status === "verified")), {headers});}
  catch (error) {reportError("GET /api/community/consent", error); return NextResponse.json({message: "Could not load sharing settings"}, {status: 503, headers});}
}
export async function PUT(request: NextRequest) {
  const user = await currentUser(); if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const input = consentMutationSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({message: "Confirm the current notice to enable sharing, or turn sharing off"}, {status: 400, headers});
  try {
    if (input.data.enabled) {
      const email = user.emailAddresses?.find((email) => email.verification?.status === "verified");
      if (!email) return NextResponse.json({message: "Verify an email address before contributing"}, {status: 403, headers});
      const result = await grantCommunityConsent({id: user.id, email: email.emailAddress, name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null});
      return NextResponse.json(result, {status: result.status, headers});
    }
    await withdrawCommunityConsent(user.id);
    return NextResponse.json({enabled: false}, {headers});
  } catch (error) {
    reportError("PUT /api/community/consent", error);
    return NextResponse.json({message: input.data.enabled ? "Could not enable sharing. Please try again." : "Could not finish removing contributions. Sharing may be paused; retry to finish cleanup."}, {status: 503, headers});
  }
}
