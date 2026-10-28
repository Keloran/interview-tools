import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {userEvent} from "@testing-library/user-event";
import ActivityLog from "@/components/ActivityLog";
import AvailabilityLinks from "@/components/AvailabilityLinks";
import {activityData} from "./fixtures/activityLog";
import {withQueryClient} from "./utils";

let data: ReturnType<typeof activityData>;
let failWrites: boolean;
beforeEach(() => {
  data = activityData(); failWrites = false;
  vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
    const method = options?.method ?? "GET";
    if (failWrites && method !== "GET") return Response.json({message: "Save failed"}, {status: 500});
    if (method === "POST") {const value = JSON.parse(options!.body as string); data.entries.push({...value, id: 2}); return Response.json({...value, id: 2}, {status: 201});}
    if (method === "PUT") {const value = JSON.parse(options!.body as string); const id = Number(url.split("/").at(-1)); data.entries = data.entries.map((entry) => entry.id === id ? {...entry, ...value} : entry); return Response.json({saved: true});}
    if (method === "DELETE") {data.entries = data.entries.filter((entry) => entry.id !== Number(url.split("/").at(-1))); return new Response(null, {status: 204});}
    return Response.json(data);
  }));
});
afterEach(() => {vi.unstubAllGlobals(); vi.restoreAllMocks();});
async function show() {
  const user = userEvent.setup();
  render(withQueryClient(<ActivityLog />));
  await screen.findByRole("heading", {name: "Job search activity log"});
  fireEvent.change(screen.getByLabelText("From"), {target: {value: "2026-01-01"}});
  fireEvent.change(screen.getByLabelText("Through"), {target: {value: "2026-01-31"}});
  return user;
}
describe("activity-log UI", () => {
  it("shows automatic and free activities with period totals and a native PDF print action", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = await show();
    expect(screen.getByText("5 activities · Applications: 1 · Interviews / assessment deadlines: 1 · Follow-ups: 1 · Availability sent: 1 · Other: 1")).toBeVisible();
    expect(screen.getByText("Careers fair", {selector: "td"})).toBeVisible();
    expect(screen.getByText("Availability sent", {selector: "td"})).toBeVisible();
    await user.click(screen.getByRole("button", {name: "Print / save PDF"}));
    expect(print).toHaveBeenCalledOnce();
    expect(screen.getByText(/choose Save as PDF/)).toBeVisible();
  });
  it("creates, edits and confirms deletion of free entries", async () => {
    const user = await show();
    await user.click(screen.getByRole("button", {name: "Add other activity"}));
    fireEvent.change(screen.getByLabelText("Activity date"), {target: {value: "2026-01-16"}});
    await user.type(screen.getByLabelText("Activity", {exact: true}), "CV workshop");
    await user.type(screen.getByLabelText("Notes (optional)"), "Practised introductions");
    await user.click(screen.getByRole("button", {name: "Save activity"}));
    expect(await screen.findByText("Activity saved.")).toBeVisible();
    expect(screen.getByText("CV workshop", {selector: "td"})).toBeVisible();
    await user.click(screen.getByRole("button", {name: "Edit CV workshop"}));
    await user.clear(screen.getByLabelText("Activity", {exact: true}));
    await user.type(screen.getByLabelText("Activity", {exact: true}), "CV review");
    await user.click(screen.getByRole("button", {name: "Save activity"}));
    await screen.findByRole("button", {name: "Edit CV review"});
    await user.click(screen.getByRole("button", {name: "Delete CV review"}));
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(false);
    await user.click(screen.getByRole("button", {name: "Confirm delete CV review"}));
    await waitFor(() => expect(screen.queryByText("CV review", {selector: "td"})).not.toBeInTheDocument());
  });
  it("keeps drafts after a failed save", async () => {
    const user = await show(); failWrites = true;
    await user.click(screen.getByRole("button", {name: "Add other activity"}));
    await user.type(screen.getByLabelText("Activity", {exact: true}), "Keep this draft");
    await user.click(screen.getByRole("button", {name: "Save activity"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed");
    expect(screen.getByLabelText("Activity", {exact: true})).toHaveValue("Keep this draft");
  });
  it("downloads a named CSV using the selected local period", async () => {
    const create = vi.fn(() => "blob:activity-log");
    vi.stubGlobal("URL", class extends URL {static createObjectURL = create; static revokeObjectURL = vi.fn();});
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {downloads.push(this.download);});
    const user = await show();
    await user.click(screen.getByRole("button", {name: "Download CSV"}));
    expect(downloads).toEqual(["job-search-activity-2026-01-01-2026-01-31.csv"]);
    expect(create).toHaveBeenCalledOnce();
  });
  it("disables exports and hides stale rows for invalid periods", async () => {
    await show();
    fireEvent.change(screen.getByLabelText("Through"), {target: {value: "2025-12-31"}});
    expect(screen.getByRole("alert")).toHaveTextContent("Choose valid dates");
    expect(screen.getByRole("button", {name: "Download CSV"})).toBeDisabled();
    expect(screen.getByRole("button", {name: "Print / save PDF"})).toBeDisabled();
    expect(screen.queryByText("Careers fair", {selector: "td"})).not.toBeInTheDocument();
  });
});
describe("availability sent records", () => {
  it("keeps copying separate from recording a send and supports clearing the record", async () => {
    const link = {id: "link", sentAt: null as string | null, path: "/availability/link", stage: "Phone Screen", slots: ["2027-01-01T12:00:00Z"], bookedSlot: null, viewCount: 0, lastViewedAt: null, created_at: "2026-01-01T12:00:00Z"};
    vi.mocked(fetch).mockImplementation(async (_url, options) => {
      if (options?.method === "PUT") {link.sentAt = JSON.parse(options.body as string).sent ? new Date().toISOString() : null; return Response.json({saved: true});}
      return Response.json({jobTitle: "Engineer", company: "Client", links: [link]});
    });
    const user = userEvent.setup();
    render(withQueryClient(<AvailabilityLinks interviewId="1" />));
    expect(await screen.findByText(/sending not recorded/)).toBeVisible();
    await user.click(screen.getByRole("button", {name: "Copy message"}));
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === "PUT")).toBe(false);
    await user.click(screen.getByRole("button", {name: "Mark sent now"}));
    await screen.findByRole("button", {name: "Clear sent record"});
    await user.click(screen.getByRole("button", {name: "Clear sent record"}));
    expect(await screen.findByText(/sending not recorded/)).toBeVisible();
  });
});
