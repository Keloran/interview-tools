import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {readCommunitySummary} from "@/lib/communityJob";
import {GET} from "@/app/api/community/employers/[id]/summary/route";
vi.mock("@/lib/communityJob", () => ({readCommunitySummary: vi.fn()}));
const id = "7a01c03a-68df-4a27-ad6f-f184c8486391", context = {params: Promise.resolve({id})};
const req = (query = "") => new NextRequest(`http://localhost/api/community/employers/${id}/summary${query}`);
beforeEach(() => vi.resetAllMocks());
describe("public aggregate endpoint", () => {
  it("returns the same generic null for unknown, invalid or suppressed records", async () => {
    vi.mocked(readCommunitySummary).mockResolvedValue(null);
    const unknown = await GET(req(), context);
    const invalid = await GET(req(), {params: Promise.resolve({id: "not-an-employer"})});
    expect(await unknown.json()).toEqual({summary: null}); expect(await invalid.json()).toEqual({summary: null});
    expect(unknown.status).toBe(invalid.status);
    expect(unknown.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  });
  it("rechecks on every request instead of serving cached data after withdrawal", async () => {
    const summary = {month: "2026-10", sampleBand: "20–49" as const, responseRate: 50, ghostingRate: 50, feedbackRate: null, replyTimeBand: null};
    vi.mocked(readCommunitySummary).mockResolvedValueOnce(summary).mockResolvedValue(null);
    expect(await (await GET(req(), context)).json()).toEqual({summary});
    expect(await (await GET(req(), context)).json()).toEqual({summary: null});
    expect(readCommunitySummary).toHaveBeenCalledTimes(2);
  });
  it("never forwards an unexpected source field even if a helper regresses", async () => {
    vi.mocked(readCommunitySummary).mockResolvedValue({month: "2026-10", sampleBand: "20–49", responseRate: 50, ghostingRate: null, feedbackRate: null, replyTimeBand: null, userId: 123} as never);
    expect(await (await GET(req(), context)).json()).toEqual({summary: null});
  });
  it("offers no cohort/date filters and never exposes database errors", async () => {
    expect((await GET(req("?from=2026-01-01"), context)).status).toBe(400);
    expect(readCommunitySummary).not.toHaveBeenCalled();
    vi.mocked(readCommunitySummary).mockRejectedValue(new Error("private userId 123"));
    const result = await GET(req(), context); expect(result.status).toBe(503);
    expect(await result.text()).not.toContain("123");
  });
});
