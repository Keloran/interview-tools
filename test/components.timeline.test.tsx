import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen, within} from "@testing-library/react";
import {userEvent} from "@testing-library/user-event";
import ApplicationTimeline from "@/components/ApplicationTimeline";
import PreviousApplications from "@/components/PreviousApplications";
import InterviewInfo from "@/components/InterviewInfo";
import {application} from "./fixtures/timeline";
import {withQueryClient} from "./utils";

beforeEach(() => {vi.stubGlobal("fetch", vi.fn(async () => Response.json(application())));});
afterEach(() => vi.unstubAllGlobals());
describe("application timeline UI", () => {
  it("shows progression, gaps, final outcome, feedback, debrief and activity", async () => {
    render(withQueryClient(<ApplicationTimeline applicationId="7" />));
    expect(await screen.findByText("Engineer · Client")).toBeVisible();
    expect(screen.getByText("Via Agency")).toBeVisible();
    expect(screen.getByText("Final outcome: Rejected")).toBeVisible();
    expect(screen.getByText("19 days in process through the latest recorded outcome update")).toBeVisible();
    expect(within(screen.getByRole("list", {name: "Application stages"})).getAllByRole("heading").map((item) => item.textContent)).toEqual(["Applied", "Technical"]);
    expect(screen.getByText("9 days after Applied")).toBeVisible();
    expect(screen.getByText("Phone · Jane")).toBeVisible();
    expect(screen.getByText("Feedback: Specific")).toBeVisible();
    expect(screen.getByText("More SQL experience")).toBeVisible();
    await userEvent.setup().click(screen.getByText("Notes and debrief"));
    expect(screen.getByText("Practice joins")).toBeVisible();
    expect(screen.getByText("Explain indexes")).toBeVisible();
    expect(screen.getByText("Follow-up recorded")).toBeVisible();
    expect(screen.getByText("Availability link first opened")).toBeVisible();
    expect(screen.getByRole("link", {name: "Back to company"})).toHaveAttribute("href", "/companies?q=Agency");
    expect(screen.getByRole("link", {name: "Interview list"})).toHaveAttribute("href", "/");
    expect(fetch).toHaveBeenCalledWith("/api/applications/7/timeline");
  });
  it("shows an applied-only application with no invented events", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(application({interviews: [], followUps: [], availabilityLinks: [], clientCompany: null})));
    render(withQueryClient(<ApplicationTimeline applicationId="7" />));
    await screen.findByText("Engineer · Agency");
    expect(screen.getByRole("heading", {name: "Applied"})).toBeVisible();
    expect(screen.getByText("No follow-ups or availability links recorded.")).toBeVisible();
    expect(screen.queryByText(/Final outcome/)).not.toBeInTheDocument();
  });
  it("offers a retry after a load failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", {status: 500}));
    render(withQueryClient(<ApplicationTimeline applicationId="7" />));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load this application");
    await userEvent.setup().click(screen.getByRole("button", {name: "Try again"}));
    expect(await screen.findByText("Engineer · Client")).toBeVisible();
  });
  it("handles deleted or inaccessible applications", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", {status: 404}));
    render(withQueryClient(<ApplicationTimeline applicationId="99" />));
    expect(await screen.findByRole("alert")).toHaveTextContent("Application not found.");
    expect(screen.getByRole("link", {name: "Back to companies"})).toHaveAttribute("href", "/companies");
  });
  it("links a company search result directly to its application", () => {
    render(<PreviousApplications applications={[{id: 7, companyName: "Agency", clientCompany: "Client", jobTitle: "Engineer", applicationDate: "2026-01-01", status: "Applied", response: "waiting", sameTitle: true, samePosting: false}]} />);
    expect(screen.getByRole("link", {name: "View application timeline"})).toHaveAttribute("href", "/applications/7");
  });
  it("links from the interview details to the parent application", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => Response.json(String(url).endsWith("/prep") ? {notes: "", storyIds: []} : String(url).includes("stories") ? [] : {applicationId: 7, company: {name: "Agency"}, jobTitle: "Engineer", stage: {stage: "Applied"}}));
    render(withQueryClient(<InterviewInfo interviewId="1" />));
    expect(await screen.findByRole("link", {name: "View application timeline"})).toHaveAttribute("href", "/applications/7");
  });
});
