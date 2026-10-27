import {NextRequest, NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import {z} from "zod";
import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";
import {MAX_CSV_BYTES, parseCSV} from "@/lib/csv";
import {importHistory, mappingSchema, planImport, summarizeImport, validateMapping} from "@/lib/csvImport";

const bodySchema = z.object({csv: z.string().max(MAX_CSV_BYTES), mapping: mappingSchema, action: z.enum(["preview", "import"])});
const select = {id: true, jobTitle: true, clientCompany: true, applicationDate: true, jobPostingLink: true, company: {select: {id: true, name: true}}} as const;
const normalizedName = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();

async function readBody(request: NextRequest): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_CSV_BYTES * 3) {await reader.cancel().catch(() => {}); return null;}
      chunks.push(decoder.decode(value, {stream: true}));
    }
    chunks.push(decoder.decode());
    return chunks.join("");
  } finally {reader.releaseLock();}
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({message: "Unauthorized"}, {status: 401});
  if (Number(request.headers.get("content-length")) > MAX_CSV_BYTES * 3) return NextResponse.json({message: "File is too large"}, {status: 413});
  let raw: string | null;
  try {raw = await readBody(request);} catch {return NextResponse.json({message: "Could not read the import request"}, {status: 400});}
  if (raw === null) return NextResponse.json({message: "File is too large"}, {status: 413});
  let json: unknown;
  try {json = JSON.parse(raw);} catch {return NextResponse.json({message: "Invalid import request"}, {status: 400});}
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({message: "Choose a CSV up to 2 MB and map its columns."}, {status: 400});
  const {csv, mapping, action} = parsed.data;
  let table: ReturnType<typeof parseCSV>;
  try {table = parseCSV(csv); validateMapping(mapping, table.headers);} catch (error) {
    return NextResponse.json({message: error instanceof Error ? error.message : "Invalid CSV"}, {status: 400});
  }
  try {
    if (action === "preview") {
      const existing = await prisma.application.findMany({where: {user: {clerkId: user.id}}, select});
      return NextResponse.json(planImport(table, mapping, importHistory(existing)), {headers: {"Cache-Control": "private, no-store"}});
    }
    const result = await prisma.$transaction(async (tx) => {
      const dbUser = await tx.user.upsert({where: {clerkId: user.id}, update: {}, create: {clerkId: user.id, email: user.emailAddresses?.[0]?.emailAddress ?? `${user.id}@example.com`}});
      // Serialize imports for this user. Read history AFTER acquiring the lock so
      // simultaneous submissions see the previous import's committed applications.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(1313, ${dbUser.id}::int)`;
      const existing = await tx.application.findMany({where: {userId: dbUser.id}, select});
      const plan = planImport(table, mapping, importHistory(existing));
      if (!plan.ready) return plan;
      const companies = await tx.company.findMany({where: {userId: dbUser.id}, select: {id: true, name: true}});
      const companyIds = new Map(companies.map((company) => [normalizedName(company.name), company.id]));
      const stage = await tx.stage.upsert({where: {stage: "Applied"}, update: {}, create: {stage: "Applied"}});
      const method = await tx.stageMethod.upsert({where: {method: "Phone"}, update: {}, create: {method: "Phone"}});
      for (const row of plan.rows) {
        if (row.status !== "ready" || !row.data) continue;
        const data = row.data;
        const name = normalizedName(data.company);
        let companyId = companyIds.get(name);
        if (companyId === undefined) {
          const company = await tx.company.upsert({where: {userId_name: {userId: dbUser.id, name: data.company}}, update: {}, create: {name: data.company, userId: dbUser.id}});
          companyId = company.id; companyIds.set(name, companyId);
        }
        const applied = new Date(data.applicationDate);
        await tx.application.create({data: {userId: dbUser.id, companyId, jobTitle: data.jobTitle, applicationDate: applied, clientCompany: data.clientCompany || null, jobPostingLink: data.jobPostingLink || null,
          interviews: {create: {stageId: stage.id, stageMethodId: method.id, outcome: data.outcome, date: null, created_at: applied, updated_at: applied}}}});
        row.status = "imported"; row.reason = "Application imported";
      }
      return summarizeImport(plan.rows);
    }, {timeout: 60000});
    return NextResponse.json(result, {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    reportError("POST /api/data/import", error);
    return NextResponse.json({message: "Import failed. Please try again; duplicate checks run again on every attempt."}, {status: 500});
  }
}
