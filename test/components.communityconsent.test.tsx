import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {userEvent} from "@testing-library/user-event";
import CommunityConsent from "@/components/CommunityConsent";
import {COMMUNITY_NOTICE_VERSION} from "@/lib/communityPolicy";
import {withQueryClient} from "./utils";
let state: {enabled: boolean; needsReview: boolean; purgePending: boolean; canEnable: boolean; verified: boolean; noticeVersion: string; agreedVersion: string | null};
let fail: boolean;
beforeEach(() => {
  state = {enabled: false, needsReview: false, purgePending: false, canEnable: true, verified: true, noticeVersion: COMMUNITY_NOTICE_VERSION, agreedVersion: null}; fail = false;
  vi.stubGlobal("fetch", vi.fn(async (_url, options?: RequestInit) => {
    if (options?.method === "PUT") {
      if (fail) return Response.json({message: "Removal pending; please retry"}, {status: 503});
      const input = JSON.parse(options.body as string); state = {...state, enabled: input.enabled, needsReview: false, purgePending: false, agreedVersion: COMMUNITY_NOTICE_VERSION};
      return Response.json({saved: true});
    }
    return Response.json(state);
  }));
});
afterEach(() => vi.unstubAllGlobals());
const writes = () => vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method === "PUT");
describe("community sharing settings", () => {
  it("defaults off and requires review plus separate agreement, with a working cancel", async () => {
    const user = userEvent.setup(); render(withQueryClient(<CommunityConsent />));
    expect(await screen.findByText("Sharing off")).toBeVisible();
    await user.click(screen.getByRole("button", {name: "Review and enable sharing"}));
    expect(writes()).toHaveLength(0);
    expect(screen.getByRole("dialog", {name: "Agree to community sharing"})).toBeVisible();
    await user.click(screen.getByRole("button", {name: "Cancel"})); expect(writes()).toHaveLength(0);
    await user.click(screen.getByRole("button", {name: "Review and enable sharing"}));
    await user.click(screen.getByRole("button", {name: "I agree — enable sharing"}));
    expect(await screen.findByText("Sharing on")).toBeVisible();
    expect(JSON.parse(writes()[0][1]!.body as string)).toEqual({enabled: true, noticeVersion: COMMUNITY_NOTICE_VERSION, confirm: true});
  });
  it("withdraws in one action and confirms completed removal only after success", async () => {
    state.enabled = true; const user = userEvent.setup(); render(withQueryClient(<CommunityConsent />));
    await user.click(await screen.findByRole("button", {name: "Stop sharing"}));
    expect(await screen.findByText("Sharing off")).toBeVisible();
    expect(JSON.parse(writes()[0][1]!.body as string)).toEqual({enabled: false});
    expect(screen.getByRole("status")).toHaveTextContent("contributions have been removed");
  });
  it("leaves removal pending and provides a retry after cleanup fails", async () => {
    state.enabled = true; fail = true; const user = userEvent.setup(); render(withQueryClient(<CommunityConsent />));
    await user.click(await screen.findByRole("button", {name: "Stop sharing"}));
    expect(await screen.findByText("Removal pending; please retry")).toBeVisible();
    expect(screen.queryByText(/contributions have been removed/)).not.toBeInTheDocument();
    state = {...state, enabled: false, purgePending: true};
    await user.click(screen.getByRole("button", {name: "Stop sharing"}));
    await waitFor(() => expect(screen.getByRole("button", {name: "Retry contribution removal"})).toBeEnabled());
    fail = false; await user.click(screen.getByRole("button", {name: "Retry contribution removal"}));
    expect(await screen.findByText("Sharing off")).toBeVisible();
  });
  it("disables collection before publication and explains an unverified account", async () => {
    state.canEnable = false; state.verified = false;
    render(withQueryClient(<CommunityConsent />));
    expect(await screen.findByRole("button", {name: "Review and enable sharing"})).toBeDisabled();
    expect(screen.getByText(/Verify your email address/)).toBeVisible(); expect(writes()).toHaveLength(0);
  });
  it("shows old-version consent as paused and still permits withdrawal", async () => {
    state.needsReview = true; state.canEnable = false; state.agreedVersion = "old";
    render(withQueryClient(<CommunityConsent />));
    expect(await screen.findByText("Sharing paused — review the updated notice")).toBeVisible();
    expect(screen.getByRole("button", {name: "Stop sharing"})).toBeEnabled();
  });
});
