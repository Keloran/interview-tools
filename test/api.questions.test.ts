import {beforeEach, describe, expect, it, vi} from "vitest";
import {GET} from "@/app/api/questions/route";
import prisma from "@/lib/prisma";
import {currentUser} from "@clerk/nextjs/server";

beforeEach(() => {vi.clearAllMocks(); vi.mocked(currentUser).mockResolvedValue({id: "user_123"} as any);});

describe("GET /api/questions", () => {
  it("rejects anonymous callers before querying private history", async () => {
    vi.mocked(currentUser).mockResolvedValueOnce(null);
    expect((await GET()).status).toBe(401);
    expect(prisma.interview.findMany).not.toHaveBeenCalled();
  });
  it("always scopes to the authenticated user and returns only question data", async () => {
    vi.mocked(prisma.interview.findMany).mockResolvedValueOnce([{id: 1, date: new Date("2026-01-01"), debriefedAt: null, created_at: new Date(), questionsAsked: "Why?", debriefNotes: "My answer", stage: {stage: "Technical"}, application: {jobTitle: "Engineer", clientCompany: "Acme", company: {name: "Agency"}}}] as any);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(prisma.interview.findMany).toHaveBeenCalledWith(expect.objectContaining({where: {application: {user: {clerkId: "user_123"}}, questionsAsked: {not: null}}}));
    expect((await response.json())[0]).toMatchObject({company: "Acme", recruiter: "Agency", questions: ["Why?"]});
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("reports database failures without returning private data", async () => {
    vi.mocked(prisma.interview.findMany).mockRejectedValueOnce(new Error("private failure"));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private failure");
  });
});
