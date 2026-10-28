import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import {userEvent} from "@testing-library/user-event";
import {CommunityRecord, CommunityRecords} from "@/components/CommunityRecord";
import CommunityLookup from "@/components/CommunityLookup";
import CommunityConsent from "@/components/CommunityConsent";
import CommunityEmployerConfirmation from "@/components/CommunityEmployerConfirmation";
import {COMMUNITY_NOTICE_VERSION} from "@/lib/communityPolicy";
import {withQueryClient} from "./utils";
const id = "7a01c03a-68df-4a27-ad6f-f184c8486391";
const summary = () => ({month: new Date().toISOString().slice(0, 7), sampleBand: "20–49", responseRate: 50, ghostingRate: 30, feedbackRate: null, replyTimeBand: "8–14 days"});
beforeEach(() => vi.stubGlobal("fetch", vi.fn(async () => Response.json({summary: summary()}))));
afterEach(() => vi.unstubAllGlobals());
describe("community records", () => {
  it("shows only coarse metrics, snapshot month and voluntary-sample context, with consent navigation", async () => {
    render(withQueryClient(<CommunityRecord employerId={id} name="Acme Ltd" />));
    expect(await screen.findByText(/Replied at least once: about 50%/)).toHaveTextContent("Median first reply: 8–14 days");
    expect(screen.getByText(/smallest metric sample 20–49/)).toHaveTextContent("Voluntary reports");
    expect(screen.queryByText(/Recorded feedback:/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", {name: "Manage community sharing"})).toHaveAttribute("href", "/community");
    expect(vi.mocked(fetch).mock.calls[0][1]).toEqual({cache: "no-store"});
  });
  it("uses generic insufficiency without counts or existence hints", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({summary: null}));
    render(withQueryClient(<CommunityRecord employerId={id} />));
    expect(await screen.findByText("Insufficient community data to show a summary.")).toBeVisible();
    expect(screen.queryByText(/sample band/)).not.toBeInTheDocument();
  });
  it("rejects stale-month or unexpected source-level data", async () => {
    const prior = new Date(); prior.setUTCMonth(prior.getUTCMonth() - 1);
    vi.mocked(fetch).mockResolvedValue(Response.json({summary: {...summary(), month: prior.toISOString().slice(0, 7)}}));
    const first = render(withQueryClient(<CommunityRecord employerId={id} />));
    expect(await screen.findByText(/Insufficient community data/)).toBeVisible(); first.unmount();
    vi.mocked(fetch).mockResolvedValue(Response.json({summary: {...summary(), userId: 123}}));
    render(withQueryClient(<CommunityRecord employerId={id} />));
    expect(await screen.findByText("Community summary unavailable.")).toBeVisible();
    expect(screen.queryByText(/50%/)).not.toBeInTheDocument();
  });
  it("deduplicates repeated private applications without guessing identities for unconfirmed records", async () => {
    render(withQueryClient(<CommunityRecords applications={[{communityEmployerId: id, communityEmployerName: "Acme"}, {communityEmployerId: id}, {}]} compact />));
    expect(await screen.findByText(/Replied at least once/)).toBeVisible();
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("clears the current tab's downloaded summary when consent is withdrawn", async () => {
    let enabled = true;
    vi.mocked(fetch).mockImplementation(async (url, options) => {
      if (options?.method === "PUT") {enabled = false; return Response.json({enabled: false});}
      if (String(url).endsWith("/consent")) return Response.json({enabled, canEnable: true, verified: true, needsReview: false, purgePending: false, noticeVersion: COMMUNITY_NOTICE_VERSION});
      return Response.json({summary: enabled ? summary() : null});
    });
    const user = userEvent.setup(); render(withQueryClient(<><CommunityConsent /><CommunityRecord employerId={id} /></>));
    await screen.findByText(/Replied at least once/);
    await user.click(await screen.findByRole("button", {name: "Stop sharing"}));
    expect(await screen.findByText("Insufficient community data to show a summary.")).toBeVisible();
    expect(screen.queryByText(/Replied at least once/)).not.toBeInTheDocument();
  });
});
describe("explicit employer confirmation", () => {
  it("does not bind similar names from a search until the user reviews and confirms one", async () => {
    const employers = [{id, name: "Acme Ltd", domain: "example.test", jurisdiction: "UK"}, {id: "other", name: "Acme Inc", domain: "example.test", jurisdiction: "US"}];
    let employer: typeof employers[number] | null = null;
    vi.mocked(fetch).mockImplementation(async (url, options) => {
      if (options?.method === "PUT") {employer = employers[0]; return Response.json({status: 200});}
      if (String(url).includes("?q=")) return Response.json(employers);
      return Response.json({applicationId: 7, sourceName: "ACME", employer, confirmed: !!employer, requiresClient: false});
    });
    const user = userEvent.setup(); render(withQueryClient(<CommunityEmployerConfirmation applicationId={7} />));
    await user.click(await screen.findByRole("button", {name: "Find reviewed employer"}));
    await user.type(screen.getByLabelText("Search reviewed employers"), "Acme");
    await user.click(await screen.findByRole("option", {name: "Acme Ltd · example.test · UK"}));
    expect(vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method === "PUT")).toHaveLength(0);
    expect(screen.getByText(/Similar names can be different companies/)).toBeVisible();
    await user.click(screen.getByRole("button", {name: "Confirm employer"}));
    expect(await screen.findByText("Employer confirmed. Your sharing preference is unchanged.")).toBeVisible();
    const write = vi.mocked(fetch).mock.calls.find(([, options]) => options?.method === "PUT")!;
    expect(JSON.parse(write[1]!.body as string)).toEqual({employerId: id, confirm: true});
  });
});

describe("community lookup before applying", () => {
  it("shows a reviewed employer's summary without linking an application or changing consent", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => String(url).includes('?q=') ? Response.json([{id, name: 'Acme Ltd', domain: 'example.test', jurisdiction: 'UK'}]) : Response.json({summary: summary()}));
    const user = userEvent.setup(); render(withQueryClient(<CommunityLookup initialQuery="Acme" />));
    await user.click(screen.getByRole('button', {name: 'Look up community employer record'}));
    await user.click(await screen.findByRole('option', {name: 'Acme Ltd · example.test · UK'}));
    expect(await screen.findByText(/Replied at least once: about 50%/)).toBeVisible();
    expect(vi.mocked(fetch).mock.calls.every(([, options]) => !options?.method)).toBe(true);
  });
});
