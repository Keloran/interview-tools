import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {PUT} from "@/app/api/applications/[id]/recruiter/route";
import {POST} from "@/app/api/interview/route";
import {GET} from "@/app/api/companies/route";
import {exportApplications} from "@/lib/csvExport";
import {parseCSV} from "@/lib/csv";

const put = (body: unknown, id = "7") => PUT(new NextRequest(`https://interviews.tools/api/applications/${id}/recruiter`, {method: "PUT", body: JSON.stringify(body)}), {params: Promise.resolve({id})});
beforeEach(() => {vi.resetAllMocks(); vi.mocked(currentUser).mockResolvedValue({id: "user_123"} as any);});
describe("private application contact updates", () => {
  it("requires authentication", async () => {
    vi.mocked(currentUser).mockResolvedValue(null);
    expect((await put({viaRecruiter: true})).status).toBe(401);
    expect(prisma.application.updateMany).not.toHaveBeenCalled();
  });
  it("scopes the update to the current owner, strips injected IDs and trims contact data", async () => {
    vi.mocked(prisma.application.updateMany).mockResolvedValue({count: 1});
    const response = await put({viaRecruiter: true, recruiterName: " Jane ", recruiterEmail: "jane@example.com", userId: 999, companyId: 5});
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(prisma.application.updateMany).toHaveBeenCalledWith({where: {id: 7, user: {clerkId: "user_123"}}, data: {viaRecruiter: true, recruiterName: "Jane", recruiterEmail: "jane@example.com", recruiterLinkedIn: null}});
  });
  it("can clear all contact fields", async () => {
    vi.mocked(prisma.application.updateMany).mockResolvedValue({count: 1});
    expect((await put({viaRecruiter: false})).status).toBe(200);
    expect(prisma.application.updateMany).toHaveBeenCalledWith(expect.objectContaining({data: {viaRecruiter: false, recruiterName: null, recruiterEmail: null, recruiterLinkedIn: null}}));
  });
  it("does not reveal whether an inaccessible application exists", async () => {
    vi.mocked(prisma.application.updateMany).mockResolvedValue({count: 0});
    expect((await put({viaRecruiter: true})).status).toBe(404);
  });
  it("rejects bad IDs, missing route choice and invalid email before writes", async () => {
    expect((await put({viaRecruiter: true}, "1e2")).status).toBe(400);
    expect((await put({recruiterName: "Jane"})).status).toBe(400);
    expect((await put({viaRecruiter: true, recruiterEmail: "bad"})).status).toBe(400);
    expect(prisma.application.updateMany).not.toHaveBeenCalled();
  });
  it("returns generic errors on failure", async () => {
    vi.mocked(prisma.application.updateMany).mockRejectedValue(new Error("private email"));
    const response = await put({viaRecruiter: true});
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private email");
  });
});
describe("application contact creation and portability", () => {
  it("rejects invalid contact details before creating application data", async () => {
    const response = await POST({json: async () => ({stage: "Applied", companyName: "Agency", jobTitle: "Engineer", recruiterLinkedIn: "javascript:alert(1)"})} as any);
    expect(response.status).toBe(400);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });
  it("creates a contact on a new application but preserves it when progressing", async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValue({id: 1} as any);
    vi.mocked(prisma.company.upsert).mockResolvedValue({id: 2} as any);
    vi.mocked(prisma.stage.upsert).mockResolvedValue({id: 3} as any);
    vi.mocked(prisma.stageMethod.findFirst).mockResolvedValue({id: 4} as any);
    vi.mocked(prisma.interview.create).mockResolvedValue({application: {id: 7, company: {name: "Agency"}}} as any);
    const body = {stage: "Applied", companyName: "Agency", jobTitle: "Engineer", viaRecruiter: true, recruiterName: "Jane", recruiterEmail: "jane@example.com"};
    expect((await POST({json: async () => body} as any)).status).toBe(201);
    expect(vi.mocked(prisma.interview.create).mock.calls[0][0].data.application).toMatchObject({create: {viaRecruiter: true, recruiterName: "Jane", recruiterEmail: "jane@example.com"}});
    vi.mocked(prisma.interview.findFirst).mockResolvedValue({id: 1, applicationId: 7} as any);
    expect((await POST({json: async () => ({...body, previousInterviewId: 1})} as any)).status).toBe(201);
    expect(vi.mocked(prisma.interview.create).mock.calls[1][0].data.application).toEqual({connect: {id: 7}});
  });
  it("returns contact details only from owned company history and disables caching", async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([{id: 1, name: "Agency", applications: [{id: 7, viaRecruiter: true, recruiterName: "Jane", recruiterEmail: "jane@example.com", interviews: [], availabilityLinks: [], _count: {followUps: 0}}]}] as any);
    const response = await GET();
    expect(prisma.company.findMany).toHaveBeenCalledWith(expect.objectContaining({where: {user: {clerkId: "user_123"}}}));
    expect((await response.json())[0].applications[0]).toMatchObject({recruiterName: "Jane", recruiterEmail: "jane@example.com"});
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("includes recruiter contact fields in owned application exports", () => {
    const table = parseCSV(exportApplications([{id: 7, company: {name: "Agency"}, applicationDate: new Date("2026-01-01"), interviews: [], viaRecruiter: true, recruiterName: "Jane", recruiterEmail: "jane@example.com", recruiterLinkedIn: "https://linkedin.com/in/jane"}] as any));
    expect(table.records[0].cells[table.headers.indexOf("recruiterEmail")]).toBe("jane@example.com");
    expect(table.records[0].cells[table.headers.indexOf("viaRecruiter")]).toBe("true");
  });
});
