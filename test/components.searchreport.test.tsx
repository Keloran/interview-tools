import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {userEvent} from "@testing-library/user-event";
import SearchReport from "@/components/SearchReport";
import {withQueryClient} from "./utils";

beforeEach(() => vi.stubGlobal("fetch", vi.fn(async () => Response.json([{id: 1, name: "Agency", applications: [{id: 7, jobTitle: "Engineer", clientCompany: "Client", applicationDate: new Date(2026, 0, 1, 12).toISOString(), firstResponseAt: "2026-01-04", status: "Rejected", response: "responded", stages: [{id: 1, stage: "Phone Screen", date: new Date(2026, 0, 5, 12).toISOString(), deadline: null, outcome: "REJECTED"}]}]}]))));
afterEach(() => vi.unstubAllGlobals());
function dates(from = "2026-01-01", through = "2026-01-31") {
  fireEvent.change(screen.getByLabelText("From"), {target: {value: from}});
  fireEvent.change(screen.getByLabelText("Through"), {target: {value: through}});
}
describe("job-search report UI", () => {
  it("updates the funnel, response metrics, weekly activity and sources for a selected local period", async () => {
    render(withQueryClient(<SearchReport />));
    await screen.findByRole("heading", {name: "Application funnel"});
    dates();
    expect(screen.getByText("Applied: 1")).toBeVisible();
    expect(screen.getByText("Screen / assessment: 1")).toBeVisible();
    expect(screen.getByText("3 days · 1 known date")).toBeVisible();
    expect(screen.getByText("Recruiter / agency")).toBeVisible();
    expect(screen.getByText("2026-01-05")).toBeVisible();
    expect(screen.getByRole("link", {name: "Company insights"})).toHaveAttribute("href", "/company-insights");
    dates("2026-02-01", "2026-02-28");
    expect(screen.getByText("Applied: 0")).toBeVisible();
    expect(screen.getByText("No applications were made in this period.")).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(1); // date selection filters private data locally
  });
  it("shows a range error and hides stale metrics for backwards dates", async () => {
    render(withQueryClient(<SearchReport />));
    await screen.findByRole("heading", {name: "Application funnel"});
    dates("2026-02-01", "2026-01-01");
    expect(screen.getByRole("alert")).toHaveTextContent("Choose valid start and end dates");
    expect(screen.queryByRole("heading", {name: "Application funnel"})).not.toBeInTheDocument();
  });
  it("shows zero-data results without NaN or manufactured response times", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json([]));
    render(withQueryClient(<SearchReport />));
    expect(await screen.findByText("No applications were made in this period.")).toBeVisible();
    expect(screen.getByText("Unknown · 0 known dates")).toBeVisible();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
  it("retries a failed report request", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", {status: 500}));
    render(withQueryClient(<SearchReport />));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your report");
    await userEvent.setup().click(screen.getByRole("button", {name: "Try again"}));
    expect(await screen.findByRole("heading", {name: "Application funnel"})).toBeVisible();
  });
});
