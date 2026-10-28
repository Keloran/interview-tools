import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {userEvent} from "@testing-library/user-event";
import StaleApplications from "@/components/StaleApplications";
import Stats from "@/components/Stats";
import InterviewsList from "@/components/InterviewsList";
import {staleCandidate} from "@/lib/staleApplications";
import {useAppStore} from "@/lib/store";
import {STALE_NOW, staleApplication} from "./fixtures/staleApplications";
import {withQueryClient} from "./utils";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({useRouter: () => ({refresh, push: vi.fn()})}));
let days: number;
let candidates: NonNullable<ReturnType<typeof staleCandidate>>[];
let fail: boolean;
beforeEach(() => {
  days = 60; fail = false; refresh.mockClear();
  useAppStore.setState({filteredDate: null, filteredCompany: null, filteredOutcome: null});
  const other = staleApplication(2); other.company.name = "Beta";
  candidates = [staleCandidate(staleApplication(), 60, STALE_NOW)!, staleCandidate(other, 60, STALE_NOW)!];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method && options.method !== "GET") {
      if (fail) return Response.json({message: "Please refresh and try again"}, {status: 500});
      const body = JSON.parse(options.body as string);
      if (options.method === "PUT") {days = body.days; return Response.json({days});}
      const closed = body.ids.filter((id: number) => id === 1), skipped = body.ids.filter((id: number) => id !== 1);
      candidates = candidates.filter((candidate) => !closed.includes(candidate.id));
      return Response.json({closed, skipped});
    }
    return Response.json({days, total: candidates.length, candidates});
  }));
});
afterEach(() => {vi.unstubAllGlobals(); useAppStore.setState({filteredDate: null, filteredCompany: null, filteredOutcome: null});});
const mutations = () => vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method === "POST");
describe("stale application review", () => {
  it("does nothing until selection, review and confirmation, and permits cancelling", async () => {
    const user = userEvent.setup();
    render(withQueryClient(<StaleApplications />));
    const checkbox = await screen.findByRole("checkbox", {name: "Engineer · Acme"});
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole("button", {name: "Review selected closures (0)"})).toBeDisabled();
    expect(mutations()).toHaveLength(0);
    await user.click(checkbox);
    await user.click(screen.getByRole("button", {name: "Review selected closures (1)"}));
    expect(mutations()).toHaveLength(0);
    await user.click(screen.getByRole("button", {name: "Cancel"}));
    expect(mutations()).toHaveLength(0);
    await user.click(screen.getByRole("button", {name: "Review selected closures (1)"}));
    await user.click(screen.getByRole("button", {name: "Confirm close as No response"}));
    expect(await screen.findByRole("status")).toHaveTextContent("Closed 1 application as No response; skipped 0");
    expect(JSON.parse(mutations()[0][1]!.body as string)).toEqual({ids: [1], days: 60, confirm: true});
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByRole("checkbox", {name: "Engineer · Acme"})).not.toBeInTheDocument();
  });
  it("selects a batch explicitly and reports records skipped by the server", async () => {
    const user = userEvent.setup();
    render(withQueryClient(<StaleApplications />));
    await screen.findByRole("checkbox", {name: "Engineer · Acme"});
    await user.click(screen.getByRole("button", {name: "Select all shown"}));
    await user.click(screen.getByRole("button", {name: "Review selected closures (2)"}));
    await user.click(screen.getByRole("button", {name: "Confirm close as No response"}));
    expect(await screen.findByRole("status")).toHaveTextContent("skipped 1");
    expect(screen.getByRole("checkbox", {name: "Engineer · Beta"})).not.toBeChecked();
  });
  it("saves the threshold and clears review without closing any records", async () => {
    const user = userEvent.setup();
    render(withQueryClient(<StaleApplications />));
    await user.click(await screen.findByRole("checkbox", {name: "Engineer · Acme"}));
    await user.click(screen.getByRole("button", {name: "Review selected closures (1)"}));
    fireEvent.change(screen.getByLabelText("Days without a change"), {target: {value: "30"}});
    await user.click(screen.getByRole("button", {name: "Save threshold"}));
    expect(await screen.findByText("2 applications eligible after 30 days without a change.")).toBeVisible();
    expect(screen.queryByRole("button", {name: "Confirm close as No response"})).not.toBeInTheDocument();
    expect(mutations()).toHaveLength(0);
  });
  it("preserves selection and review after a failed closure", async () => {
    const user = userEvent.setup(); fail = true;
    render(withQueryClient(<StaleApplications />));
    await user.click(await screen.findByRole("checkbox", {name: "Engineer · Acme"}));
    await user.click(screen.getByRole("button", {name: "Review selected closures (1)"}));
    await user.click(screen.getByRole("button", {name: "Confirm close as No response"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("refresh and try again");
    expect(screen.getByRole("checkbox", {name: "Engineer · Acme"})).toBeChecked();
    expect(screen.getByRole("button", {name: "Confirm close as No response"})).toBeEnabled();
  });
});
describe("closed application presentation", () => {
  it("shows ghosted and awaiting response as separate stats", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json([{id: 1, outcome: "NO_RESPONSE", stage: {id: 8}}, {id: 2, outcome: "AWAITING_RESPONSE", stage: {id: 8}}]));
    render(withQueryClient(<Stats />));
    const ghosted = await screen.findByText("Ghosted (No response)");
    expect(within(ghosted.parentElement!).getByText("1")).toBeVisible();
    expect(within(screen.getByText("Awaiting Response").parentElement!).getByText("1")).toBeVisible();
  });
  it("uses the applied date for an unscheduled closed row and supports reopening", async () => {
    const row = {id: 1, applicationId: 7, jobTitle: "Engineer", applicationDate: "2026-01-01T12:00:00Z", date: null, deadline: null, company: {id: 1, name: "Acme"}, stage: {stage: "Applied"}, stageMethod: {method: "Phone"}, outcome: "NO_RESPONSE"};
    vi.mocked(fetch).mockImplementation(async (_url, options) => {
      if (options?.method === "PUT") {row.outcome = JSON.parse(options.body as string).outcome; return Response.json({saved: true});}
      return Response.json([row]);
    });
    const user = userEvent.setup();
    render(withQueryClient(<InterviewsList />));
    await user.click(await screen.findByRole("button", {name: "More actions for Engineer at Acme"}));
    await user.click(screen.getByRole("menuitem", {name: "Reopen application"}));
    await waitFor(() => expect(screen.queryByRole("menuitem", {name: "Reopen application"})).not.toBeInTheDocument());
    expect(row.outcome).toBe("AWAITING_RESPONSE");
    expect(screen.queryByText(/1970/)).not.toBeInTheDocument();
  });
});
