import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {userEvent} from "@testing-library/user-event";
import CompanyInsights from "@/components/CompanyInsights";
import FirstReplyDate from "@/components/FirstReplyDate";
import {CompanyHistory} from "@/lib/applications";
import {withQueryClient} from "./utils";

let history: CompanyHistory[];
beforeEach(() => {
  history = [{id: 1, name: "Slow Co", applications: [{id: 7, jobTitle: "Engineer", clientCompany: null, applicationDate: "2026-01-01T12:00:00Z", firstResponseAt: null, status: "Applied", response: "ghosted", furthestStage: "Applied", ignoredLinks: 1}]}, {id: 2, name: "Fast Co", applications: [{id: 8, jobTitle: "Designer", clientCompany: "Client", applicationDate: "2026-02-01T12:00:00Z", firstResponseAt: "2026-02-02T00:00:00Z", status: "Rejected", response: "responded", feedback: "SPECIFIC", furthestStage: "Final Stage", ignoredLinks: 0}]}];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === "PUT") {
      const value = JSON.parse(options.body as string).firstResponseAt;
      history[0].applications[0].firstResponseAt = value;
      history[0].applications[0].response = value ? "responded" : "ghosted";
      return Response.json({firstResponseAt: value});
    }
    return Response.json(history);
  }));
});
afterEach(() => vi.unstubAllGlobals());
describe("company insights pages", () => {
  it("shows response rates, monthly cohorts and ranks only known reply dates", async () => {
    render(withQueryClient(<CompanyInsights />));
    expect(await screen.findByRole("heading", {name: "Company insights"})).toBeVisible();
    expect(screen.getByText("1 day · 1 known date")).toBeVisible();
    expect(screen.getByRole("link", {name: "Fast Co"})).toHaveAttribute("href", "/companies/2");
    expect(screen.getByRole("link", {name: "Slow Co"})).toHaveAttribute("href", "/companies/1");
    expect(screen.getByText("2026-01")).toBeVisible();
    expect(screen.getByText("2026-02")).toBeVisible();
    expect(screen.getByText(/unknown historical dates are excluded/)).toBeVisible();
  });
  it("shows the company history and refreshes its median after explicitly recording a reply", async () => {
    const user = userEvent.setup();
    render(withQueryClient(<CompanyInsights companyId="1" />));
    expect(await screen.findByRole("heading", {name: "Slow Co: your history"})).toBeVisible();
    expect(screen.getByText("Unknown · 0 known dates")).toBeVisible();
    expect(screen.getByText("First reply: Unknown")).toBeVisible();
    await user.click(screen.getByRole("button", {name: "Record or correct first reply"}));
    expect(screen.getByLabelText("First reply date")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("First reply date"), {target: {value: "2026-01-04"}});
    await user.click(screen.getByRole("button", {name: "Save first-reply date"}));
    expect(await screen.findByText("3 days · 1 known date")).toBeVisible();
    expect(screen.getByText("First reply: 2026-01-04")).toBeVisible();
    expect(screen.getByRole("link", {name: "All company insights"})).toHaveAttribute("href", "/company-insights");
  });
  it("handles unknown or inaccessible companies without showing another history", async () => {
    render(withQueryClient(<CompanyInsights companyId="99" />));
    expect(await screen.findByRole("alert")).toHaveTextContent("Company not found.");
    expect(screen.queryByText("Engineer")).not.toBeInTheDocument();
  });
  it("shows meaningful empty states instead of manufactured rates", async () => {
    history = [];
    render(withQueryClient(<CompanyInsights />));
    expect(await screen.findByText("No application history yet.")).toBeVisible();
    expect(screen.getByText(/Record a first-reply date on an application/)).toBeVisible();
    expect(screen.getByText("Unknown · 0 known dates")).toBeVisible();
  });
  it("allows retrying after a failed history request", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", {status: 500}));
    render(withQueryClient(<CompanyInsights />));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load company insights");
    await userEvent.setup().click(screen.getByRole("button", {name: "Try again"}));
    expect(await screen.findByText("1 day · 1 known date")).toBeVisible();
  });
});
describe("first reply date editing", () => {
  it("retains the entered date after validation errors and supports clearing it", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({message: "The first reply cannot be before you applied."}, {status: 400}));
    const user = userEvent.setup();
    render(withQueryClient(<FirstReplyDate applicationId={7} applied="2026-01-01" value="2026-01-04" />));
    await user.click(screen.getByRole("button", {name: "Record or correct first reply"}));
    fireEvent.change(screen.getByLabelText("First reply date"), {target: {value: "2025-12-31"}});
    await user.click(screen.getByRole("button", {name: "Save first-reply date"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("cannot be before you applied");
    expect(screen.getByLabelText("First reply date")).toHaveValue("2025-12-31");
    fireEvent.change(screen.getByLabelText("First reply date"), {target: {value: ""}});
    await user.click(screen.getByRole("button", {name: "Save first-reply date"}));
    await waitFor(() => expect(screen.queryByRole("button", {name: "Save first-reply date"})).not.toBeInTheDocument());
    expect(JSON.parse(vi.mocked(fetch).mock.calls.at(-1)![1]!.body as string)).toEqual({firstResponseAt: null});
  });
});
