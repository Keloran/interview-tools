import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import {z} from "zod";
import {reportError} from "@/lib/bugfixes";
import {loadCompanyHistory} from "@/lib/companyHistory";
import {findPreviousApplications} from "@/lib/applications";
import {checkJobListing} from "@/lib/jobChecks";

const checkSchema = z.object({
  link: z.string().max(2000).optional().default(""),
  title: z.string().max(300).optional().default(""),
  company: z.string().max(300).optional().default(""),
  client: z.string().max(300).optional().default(""),
  description: z.string().max(100_000).optional().default(""),
});

// "Have I applied?" and the listing checks for the apps, using the same matching as the website
export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  const parsed = checkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({message: "Invalid check"}, {status: 400});
  const {link, title, company, client, description} = parsed.data;
  try {
    const history = await loadCompanyHistory(user.id);
    const matches = findPreviousApplications(history, company, client, title, link);
    const flags = description.trim() ? checkJobListing({description, history, companyName: company, jobTitle: title, jobPostingLink: link}) : [];
    return NextResponse.json({matches, flags}, {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("POST /api/check", error);
    return NextResponse.json({message: "Could not check this job"}, {status: 500});
  }
}
