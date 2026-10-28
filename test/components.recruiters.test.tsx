import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {userEvent} from "@testing-library/user-event";
import RecruitersDirectory from "@/components/RecruitersDirectory";
import RecruiterContact from "@/components/RecruiterContact";
import InterviewForm from "@/components/InterviewForm";
import {withQueryClient} from "./utils";

const history = [{id: 1, name: "Recruit Co", applications: [{id: 7, jobTitle: "Engineer", clientCompany: "Client", applicationDate: "2026-01-01", viaRecruiter: true, recruiterName: "Jane", recruiterEmail: "jane@example.com", recruiterLinkedIn: "https://linkedin.com/in/jane", status: "No response after Applied", response: "ghosted", feedback: null}, {id: 8, jobTitle: "Designer", clientCompany: "Other client", applicationDate: "2026-01-01", viaRecruiter: true, status: "Rejected", response: "responded", feedback: "SPECIFIC"}]}, {id: 2, name: "Direct", applications: [{id: 9, jobTitle: "Tester", clientCompany: null, viaRecruiter: false, response: "waiting"}]}];
beforeEach(() => vi.stubGlobal("fetch", vi.fn(async () => Response.json(history))));
afterEach(() => vi.unstubAllGlobals());
describe("recruiter directory", () => {
  it("shows agency and contact records with roles, shared rates and safe links", async () => {
    render(withQueryClient(<RecruitersDirectory />));
    expect(await screen.findByRole("heading", {name: "Recruit Co"})).toBeVisible();
    expect(screen.getByRole("heading", {name: "Jane · Recruit Co"})).toBeVisible();
    expect(screen.getByText("2 roles · responded to 1 · ghosted 1 · waiting 0")).toBeVisible();
    expect(screen.getByText("Response rate: 50% · Ghost rate: 50%")).toBeVisible();
    expect(screen.getByText("Feedback: 1 of 1 noted rejections (100%)")).toBeVisible();
    expect(screen.queryByRole("heading", {name: "Direct"})).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getAllByText("Roles put forward")[0]);
    expect(screen.getAllByRole("link", {name: "Engineer · Client"})[0]).toHaveAttribute("href", "/companies?q=Recruit%20Co");
    expect(screen.getByRole("link", {name: "LinkedIn profile"})).toHaveAttribute("rel", "noopener noreferrer");
  });
  it("searches contacts by email and roles by client", async () => {
    const user = userEvent.setup();
    render(withQueryClient(<RecruitersDirectory />));
    await screen.findByRole("heading", {name: "Recruit Co"});
    await user.type(screen.getByLabelText("Search recruiters and agencies"), "jane@example.com");
    expect(screen.getByRole("heading", {name: "Jane · Recruit Co"})).toBeVisible();
    expect(screen.queryByRole("heading", {name: "Recruit Co"})).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("Search recruiters and agencies"));
    await user.type(screen.getByLabelText("Search recruiters and agencies"), "Other client");
    expect(screen.getByRole("heading", {name: "Recruit Co"})).toBeVisible();
    expect(screen.queryByRole("heading", {name: "Jane · Recruit Co"})).not.toBeInTheDocument();
  });
});
describe("contact editing", () => {
  it("saves validated recruiter details on the application and closes the editor", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({saved: true}));
    const user = userEvent.setup();
    render(withQueryClient(<RecruiterContact applicationId={7} agency="Recruit Co" contact={{viaRecruiter: true, recruiterName: "Jane"}} />));
    await user.click(screen.getByRole("button", {name: "Edit recruiter details"}));
    await user.type(screen.getByLabelText("Recruiter email (optional)"), "jane@example.com");
    await user.click(screen.getByRole("button", {name: "Save recruiter details"}));
    await waitFor(() => expect(screen.queryByRole("button", {name: "Save recruiter details"})).not.toBeInTheDocument());
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/applications/7/recruiter");
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toMatchObject({viaRecruiter: true, recruiterName: "Jane", recruiterEmail: "jane@example.com"});
  });
  it("keeps drafts after failed saves and cancel discards them", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", {status: 500}));
    const user = userEvent.setup();
    render(withQueryClient(<RecruiterContact applicationId={7} agency="Recruit Co" contact={{viaRecruiter: true, recruiterName: "Jane"}} />));
    await user.click(screen.getByRole("button", {name: "Edit recruiter details"}));
    await user.type(screen.getByLabelText("Recruiter name (optional)"), " Smith");
    await user.click(screen.getByRole("button", {name: "Save recruiter details"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your edits are still here");
    expect(screen.getByLabelText("Recruiter name (optional)")).toHaveValue("Jane Smith");
    await user.click(screen.getByRole("button", {name: "Cancel"}));
    await user.click(screen.getByRole("button", {name: "Edit recruiter details"}));
    expect(screen.getByLabelText("Recruiter name (optional)")).toHaveValue("Jane");
  });
  it("rejects an unsafe LinkedIn URL before submitting", async () => {
    const user = userEvent.setup();
    render(withQueryClient(<RecruiterContact applicationId={7} agency="Recruit Co" contact={{viaRecruiter: true}} />));
    await user.click(screen.getByRole("button", {name: "Edit recruiter details"}));
    await user.type(screen.getByLabelText("Recruiter LinkedIn (optional)"), "https://evil.example/in/jane");
    await user.click(screen.getByRole("button", {name: "Save recruiter details"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTPS linkedin.com");
    expect(fetch).not.toHaveBeenCalled();
  });
});
describe("adding a recruiter application", () => {
  it("shows the chosen agency record and submits optional contact details", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => Response.json(String(url).endsWith("stages") ? [{id: 1, stage: "Applied"}] : history));
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(withQueryClient(<InterviewForm initialValues={{companyName: "Recruit Co", jobTitle: "Engineer"}} onSubmit={onSubmit} />));
    expect(await screen.findByText("Recruit Co: your agency record")).toBeVisible();
    expect(screen.getByText("2 roles · responded to 1 · ghosted 1 · waiting 0")).toBeVisible();
    await user.click(screen.getByRole("checkbox", {name: "Via a recruiter or agency"}));
    await user.type(screen.getByLabelText("Recruiter name (optional)"), "Jane");
    await user.type(screen.getByLabelText("Recruiter email (optional)"), "jane@example.com");
    await user.click(screen.getByRole("button", {name: "Add Interview Stage"}));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({viaRecruiter: true, recruiterName: "Jane", recruiterEmail: "jane@example.com"}));
  });
});
