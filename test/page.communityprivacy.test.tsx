import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import prisma from "@/lib/prisma";
import CommunityPrivacyPage from "@/app/privacy/community/page";
import {COMMUNITY_NOTICE_VERSION} from "@/lib/communityPolicy";
beforeEach(() => {vi.stubEnv("COMMUNITY_OPERATOR_NAME", "Keloran LTD"); vi.stubEnv("COMMUNITY_PRIVACY_EMAIL", "compliance@chewedfeed.com"); vi.mocked(prisma.communityControl.findUnique).mockResolvedValue(null);});
afterEach(() => vi.unstubAllEnvs());
describe("public community feature notice", () => {
  it("shows the supplied operator/contact and keeps the notice awaiting publication by default", async () => {
    render(await CommunityPrivacyPage());
    expect(screen.getByRole("status")).toHaveTextContent("awaiting publication");
    expect(screen.getByText(/Keloran LTD/)).toBeVisible();
    expect(screen.getByRole("link", {name: "compliance@chewedfeed.com"})).toHaveAttribute("href", "mailto:compliance@chewedfeed.com");
    expect(screen.getByText(`Version ${COMMUNITY_NOTICE_VERSION}`)).toBeVisible();
  });
  it("displays a published notice independently of disabled collection/publication gates", async () => {
    vi.mocked(prisma.communityControl.findUnique).mockResolvedValue({id: "global", noticeVersion: COMMUNITY_NOTICE_VERSION, noticePublishedAt: new Date("2026-01-01"), collectionEnabled: false, publicationEnabled: false, revocationEpoch: 0});
    render(await CommunityPrivacyPage());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("link", {name: "Manage community sharing"})).toHaveAttribute("href", "/community");
  });
  it("fails closed if controls cannot be read", async () => {
    vi.mocked(prisma.communityControl.findUnique).mockRejectedValue(new Error("db offline"));
    render(await CommunityPrivacyPage());
    expect(screen.getByRole("status")).toHaveTextContent("cannot be enabled");
  });
});
