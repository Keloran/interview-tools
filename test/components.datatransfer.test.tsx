import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {userEvent} from "@testing-library/user-event";
import DataTransfer from "@/components/DataTransfer";
import {parseCSV} from "@/lib/csv";
import {planImport, summarizeImport} from "@/lib/csvImport";
import {withQueryClient} from "./utils";

const csv = "company,title,date applied\nAcme,Engineer,2026-01-01\nAcme,Engineer,2026-01-01\nOther,Designer,invalid";
let fail: boolean;
beforeEach(() => {
  fail = false;
  vi.stubGlobal("fetch", vi.fn(async (_url: string, options?: RequestInit) => {
    if (fail) return Response.json({message: "Please try again"}, {status: 500});
    const body = JSON.parse(options!.body as string);
    const plan = planImport(parseCSV(body.csv), body.mapping);
    return Response.json(body.action === "import" ? summarizeImport(plan.rows.map((row) => row.status === "ready" ? {...row, status: "imported", reason: "Application imported"} : row)) : plan);
  }));
});
afterEach(() => {vi.unstubAllGlobals(); vi.restoreAllMocks();});

async function upload(contents = csv) {
  const user = userEvent.setup();
  render(withQueryClient(<DataTransfer />));
  await user.upload(screen.getByLabelText("CSV file"), new File([contents], "applications.csv", {type: "text/csv"}));
  await screen.findByRole("button", {name: "Preview import"});
  return user;
}

describe("data transfer UI", () => {
  it("previews mapped rows before import, reports errors and skips duplicates", async () => {
    const user = await upload();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", {name: "Import 1 application"})).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", {name: "Preview import"}));
    expect(await screen.findByRole("status")).toHaveTextContent("1 ready · 0 imported · 1 duplicate · 1 invalid");
    await user.selectOptions(screen.getByLabelText("Show rows"), "error");
    expect(screen.getByText("Designer")).toBeVisible();
    expect(screen.queryByText("Engineer")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", {name: "Import 1 application"}));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("0 ready · 1 imported · 1 duplicate · 1 invalid"));
    expect(vi.mocked(fetch).mock.calls.map(([, options]) => JSON.parse(options!.body as string).action)).toEqual(["preview", "import"]);
    expect(screen.queryByRole("button", {name: "Import 1 application"})).not.toBeInTheDocument();
  });
  it("requires manual mapping for unknown headers and clears a stale preview on changes", async () => {
    const user = await upload("A,B,C\nAcme,Engineer,2026-01-01");
    expect(screen.getByRole("button", {name: "Preview import"})).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Company"), "0");
    await user.selectOptions(screen.getByLabelText("Job title"), "1");
    await user.selectOptions(screen.getByLabelText("Date applied"), "2");
    await user.click(screen.getByRole("button", {name: "Preview import"}));
    await screen.findByRole("status");
    await user.selectOptions(screen.getByLabelText("Company"), "");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", {name: "Import 1 application"})).not.toBeInTheDocument();
  });
  it("preserves preview and file after a failed import so it can be retried", async () => {
    const user = await upload();
    await user.click(screen.getByRole("button", {name: "Preview import"}));
    await screen.findByRole("status");
    fail = true;
    await user.click(screen.getByRole("button", {name: "Import 1 application"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again");
    expect(screen.getByRole("button", {name: "Import 1 application"})).toBeEnabled();
    expect(screen.getByLabelText("Company")).toHaveValue("0");
  });
  it("rejects malformed CSV locally", async () => {
    const user = userEvent.setup();
    render(withQueryClient(<DataTransfer />));
    await user.upload(screen.getByLabelText("CSV file"), new File(['company,title\n"unterminated'], "bad.csv", {type: "text/csv"}));
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", {name: "Preview import"})).not.toBeInTheDocument();
  });
  it("downloads both owned export formats with descriptive filenames", async () => {
    const create = vi.fn(() => "blob:export");
    vi.stubGlobal("URL", class extends URL {static createObjectURL = create; static revokeObjectURL = vi.fn();});
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {downloads.push(this.download);});
    vi.mocked(fetch).mockResolvedValue(new Response("company,title\nAcme,Engineer"));
    const user = userEvent.setup();
    render(withQueryClient(<DataTransfer />));
    await user.click(screen.getByRole("button", {name: "Export applications and stages"}));
    await waitFor(() => expect(downloads).toEqual(["interview-tools-applications.csv"]));
    vi.mocked(fetch).mockResolvedValue(new Response("title,situation"));
    await user.click(screen.getByRole("button", {name: "Export stories"}));
    await waitFor(() => expect(downloads).toContain("interview-tools-stories.csv"));
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual(["/api/data/export?kind=applications", "/api/data/export?kind=stories"]);
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("shows failed downloads without starting a file download", async () => {
    fail = true;
    const user = userEvent.setup();
    render(withQueryClient(<DataTransfer />));
    await user.click(screen.getByRole("button", {name: "Export stories"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not download your export");
  });
});
