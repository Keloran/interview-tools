import {NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import {reportError} from "@/lib/bugfixes";
import {loadCompanyHistory} from "@/lib/companyHistory";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  try {
    return NextResponse.json(await loadCompanyHistory(user.id), {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("Error fetching companies: ", error);
    return NextResponse.json({message: "Failed to fetch companies"}, {status: 500});
  }
}
