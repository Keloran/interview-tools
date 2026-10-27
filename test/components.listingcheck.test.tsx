import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, render, screen, within} from "@testing-library/react";
import {userEvent} from "@testing-library/user-event";
import {useUser} from "@clerk/nextjs";
import ListingCheck from "@/components/ListingCheck";
import JobBookmarklet from "@/components/JobBookmarklet";
import {listingCheckPath} from "@/lib/listingImport";
import {withQueryClient} from "./utils";

vi.mock("@clerk/nextjs", () => ({
  useUser: vi.fn(),
  SignInButton: ({children, forceRedirectUrl, signUpForceRedirectUrl}: any) => <div data-testid="sign-in" data-signin={forceRedirectUrl} data-signup={signUpForceRedirectUrl}>{children}</div>,
}));

const imported = {url: "https://example.com/jobs/1", title: "Backend Engineer", company: "Acme"};
const history = [{id: 1, name: "Acme", applications: [{id: 1, jobTitle: "Backend Engineer", clientCompany: null, jobPostingLink: imported.url, applicationDate: "2026-01-01", response: "waiting", status: "Applied"}]}];

beforeEach(() => {
  vi.mocked(useUser).mockReturnValue({user: {id: "user_123"}, isLoaded: true} as any);
  window.history.replaceState({}, "", listingCheckPath(imported));
  vi.stubGlobal("fetch", vi.fn(async (url) => new Response(JSON.stringify(url === "/api/stages" ? [{id: 1, stage: "Applied"}] : history))));
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/check");
});

describe("receiving a listing", () => {
  it("prefills and automatically checks a known job", async () => {
    render(withQueryClient(<ListingCheck />));
    expect(screen.getByLabelText("Job link or company")).toHaveValue(imported.url);
    expect(screen.getByLabelText("Job title")).toHaveValue(imported.title);
    expect(screen.getByLabelText("Company or recruiter (optional)")).toHaveValue(imported.company);
    expect(await screen.findByText("Yes, you've applied for this")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/companies", {method: "GET"});
  });

  it("waits for history before showing a duplicate result", async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => {finish = resolve;})));
    render(withQueryClient(<ListingCheck />));
    expect(screen.getByRole("status")).toHaveTextContent("Checking your saved applications");
    expect(screen.queryByText("No matching application found")).not.toBeInTheDocument();
    await act(async () => finish(new Response(JSON.stringify(history))));
    expect(await screen.findByText("Yes, you've applied for this")).toBeInTheDocument();
  });

  it("does not show a reassuring result when history fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", {status: 500})));
    render(withQueryClient(<ListingCheck />));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your application history");
    expect(screen.queryByText("No matching application found")).not.toBeInTheDocument();
    expect(screen.queryByText(/No warning signs found/)).not.toBeInTheDocument();
  });

  it("preserves the imported job for both sign-in and sign-up", () => {
    vi.mocked(useUser).mockReturnValue({user: null, isLoaded: true} as any);
    render(withQueryClient(<ListingCheck />));
    expect(screen.getByTestId("sign-in")).toHaveAttribute("data-signin", listingCheckPath(imported));
    expect(screen.getByTestId("sign-in")).toHaveAttribute("data-signup", listingCheckPath(imported));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("offers manual entry for an invalid import without using an external redirect", () => {
    window.history.replaceState({}, "", "/check#job=javascript:alert(1)&returnTo=https://evil.test");
    render(withQueryClient(<ListingCheck />));
    expect(screen.getByRole("alert")).toHaveTextContent("Paste the link");
    expect(screen.getByLabelText("Job link or company")).toHaveValue("");
  });

  it("can edit imported values and prefill Add it without saving automatically", async () => {
    const user = userEvent.setup();
    render(withQueryClient(<ListingCheck />));
    await screen.findByText("Yes, you've applied for this");
    await user.clear(screen.getByLabelText("Job link or company"));
    await user.type(screen.getByLabelText("Job link or company"), "https://example.com/jobs/2");
    await user.clear(screen.getByLabelText("Job title"));
    await user.type(screen.getByLabelText("Job title"), "Data Analyst");
    await user.click(screen.getByRole("button", {name: "Check"}));
    await user.click(screen.getByRole("button", {name: "Add it"}));
    const dialog = await screen.findByRole("dialog", {name: "Add application"});
    expect(within(dialog).getByLabelText("Job title")).toHaveValue("Data Analyst");
    expect(within(dialog).getByLabelText("Job posting link")).toHaveValue("https://example.com/jobs/2");
    expect(within(dialog).getByLabelText("Company name")).toHaveTextContent("Acme");
    expect(vi.mocked(fetch).mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true);
  });

  it("handles a second imported listing without keeping the first query", async () => {
    render(withQueryClient(<ListingCheck />));
    await screen.findByText("Yes, you've applied for this");
    await act(async () => {
      window.history.replaceState({}, "", listingCheckPath({...imported, url: "https://example.com/jobs/new", title: "Designer"}));
      window.dispatchEvent(new Event("hashchange"));
    });
    expect(screen.getByLabelText("Job title")).toHaveValue("Designer");
    expect(screen.queryByText("Yes, you've applied for this")).not.toBeInTheDocument();
  });
});

describe("bookmark installation", () => {
  it("provides the real draggable bookmark URL and copies it", async () => {
    const user = userEvent.setup();
    const copy = vi.spyOn(navigator.clipboard, "writeText");
    render(<JobBookmarklet />);
    const link = screen.getByRole("link", {name: "Check this job"});
    expect(link.getAttribute("href")).toMatch(/^javascript:/);
    expect(link).toHaveAttribute("draggable", "true");
    await user.click(screen.getByRole("button", {name: "Copy bookmark URL"}));
    expect(copy).toHaveBeenCalledWith(link.getAttribute("href"));
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
  });
  it("explains drag installation if the clipboard fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("denied"));
    render(<JobBookmarklet />);
    await user.click(screen.getByRole("button", {name: "Copy bookmark URL"}));
    expect(screen.getByRole("status")).toHaveTextContent("Drag");
  });
});
