import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, render, screen, waitFor} from "@testing-library/react";
import {userEvent} from "@testing-library/user-event";
import StoryBank, {StorySuggestions} from "@/components/StoryBank";
import InterviewPrep from "@/components/InterviewPrep";
import {Story} from "@/lib/stories";
import {withQueryClient} from "./utils";

let stories: Story[];
let prep: {notes: string; storyIds: number[]};
let failWrites: boolean;
beforeEach(() => {
  stories = [{id: 1, title: "Conflict", situation: "A disagreement", task: "Resolve it", action: "Discussed", result: "Agreed", tags: ["conflict"], usedIn: [{interviewId: 7, company: "Acme", stage: "Technical"}]}, {id: 2, title: "Delivery", situation: "Late deadline", task: "Ship", action: "Prioritised", result: "Delivered", tags: ["delivery"], usedIn: []}];
  prep = {notes: "Research Acme before the interview", storyIds: [1]};
  failWrites = false;
  vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
    const method = options?.method ?? "GET";
    if (method !== "GET" && failWrites) return new Response("{}", {status: 500});
    if (url.endsWith("/prep")) {
      if (method === "PUT") prep = JSON.parse(options!.body as string);
      return new Response(JSON.stringify(prep));
    }
    if (method === "POST") {const value = JSON.parse(options!.body as string); stories.push({...value, id: 3, usedIn: []}); return new Response(JSON.stringify(stories.at(-1)), {status: 201});}
    if (method === "PUT") {const value = JSON.parse(options!.body as string); const id = Number(url.split("/").at(-1)); stories = stories.map((story) => story.id === id ? {...story, ...value} : story); return new Response("{}");}
    if (method === "DELETE") {stories = stories.filter((story) => story.id !== Number(url.split("/").at(-1))); return new Response(null, {status: 204});}
    return new Response(JSON.stringify(stories));
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("story bank UI", () => {
  it("creates a partial STAR answer, normalises tags and searches the bank", async () => {
    const user = userEvent.setup();
    render(withQueryClient(<StoryBank />));
    await screen.findByText("Selected for: Acme · Technical");
    await user.click(screen.getByRole("button", {name: "Add story"}));
    await user.type(screen.getByLabelText("Title"), "Leading a team");
    await user.type(screen.getByLabelText(/situation/i), "We needed direction");
    await user.type(screen.getByLabelText(/Tags \(comma separated\)/), "Leadership, leadership");
    await user.click(screen.getByRole("button", {name: "Save story"}));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(stories.at(-1)).toMatchObject({title: "Leading a team", tags: ["leadership"], situation: "We needed direction"});
    await user.type(screen.getByLabelText("Search stories and tags"), "leadership");
    expect(screen.getByText("Leading a team")).toBeInTheDocument();
    expect(screen.queryByText("Conflict")).not.toBeInTheDocument();
  });
  it("edits a reusable story and preserves its links", async () => {
    const user = userEvent.setup();
    render(withQueryClient(<StoryBank />));
    await user.click(await screen.findByRole("button", {name: "Edit Conflict"}));
    expect(screen.getByText(/updates the answer wherever/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/action/i));
    await user.type(screen.getByLabelText(/action/i), "Listened first");
    await user.click(screen.getByRole("button", {name: "Save story"}));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(stories[0]).toMatchObject({action: "Listened first", usedIn: [{interviewId: 7, company: "Acme", stage: "Technical"}]});
  });
  it("requires confirmation before deleting and refreshes the list", async () => {
    const user = userEvent.setup();
    render(withQueryClient(<StoryBank />));
    await user.click(await screen.findByRole("button", {name: "Delete Conflict"}));
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(false);
    await user.click(screen.getByRole("button", {name: "Confirm delete"}));
    await waitFor(() => expect(screen.queryByRole("button", {name: "Delete Conflict"})).not.toBeInTheDocument());
    expect(screen.getByText("Delivery")).toBeInTheDocument();
  });
  it("keeps edits available after a failed save", async () => {
    failWrites = true;
    const user = userEvent.setup();
    render(withQueryClient(<StoryBank />));
    await user.click(screen.getByRole("button", {name: "Add story"}));
    await user.type(screen.getByLabelText("Title"), "Keep this draft");
    await user.click(screen.getByRole("button", {name: "Save story"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your edits are still here");
    expect(screen.getByLabelText("Title")).toHaveValue("Keep this draft");
  });
  it("suggests tagged stories for matching question topics", async () => {
    render(withQueryClient(<StorySuggestions topics={["conflict"]} />));
    expect(await screen.findByRole("link", {name: "Conflict"})).toHaveAttribute("href", "/stories?q=Conflict");
    expect(screen.queryByText("Delivery")).not.toBeInTheDocument();
  });
});

describe("preparation UI", () => {
  it("shows notes and selected stories before a debrief exists without writing", async () => {
    render(withQueryClient(<InterviewPrep interviewId="7" />));
    expect(await screen.findByText(prep.notes, {selector: "p"})).toBeVisible();
    expect(await screen.findByText("Conflict", {selector: "summary"})).toBeVisible();
    expect(vi.mocked(fetch).mock.calls.every(([, options]) => !options?.method)).toBe(true);
  });
  it("saves prep notes and selected story references for a stage", async () => {
    const user = userEvent.setup();
    render(withQueryClient(<InterviewPrep interviewId="7" />));
    await screen.findByText(prep.notes, {selector: "p"});
    await user.click(screen.getByText("Edit preparation"));
    await user.clear(screen.getByLabelText("Company research, questions to ask and prep notes"));
    await user.type(screen.getByLabelText("Company research, questions to ask and prep notes"), "Ask about deployment");
    await user.click(screen.getByRole("checkbox", {name: "Conflict"}));
    await user.click(screen.getByRole("checkbox", {name: "Delivery"}));
    await user.click(screen.getByRole("button", {name: "Save preparation"}));
    expect(await screen.findByRole("status")).toHaveTextContent("Preparation saved");
    expect(prep).toEqual({notes: "Ask about deployment", storyIds: [2]});
  });
  it("retains unsaved notes when the preparation API fails", async () => {
    failWrites = true;
    const user = userEvent.setup();
    render(withQueryClient(<InterviewPrep interviewId="7" />));
    await screen.findByText(prep.notes, {selector: "p"});
    await user.click(screen.getByText("Edit preparation"));
    await user.type(screen.getByLabelText("Company research, questions to ask and prep notes"), " More notes");
    await user.click(screen.getByRole("button", {name: "Save preparation"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your changes are still here");
    expect(screen.getByLabelText("Company research, questions to ask and prep notes")).toHaveValue(`${prep.notes} More notes`);
  });
  it("prevents conflicting edits while a save is pending", async () => {
    let finish!: () => void;
    vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.method === "PUT") return new Promise<Response>((resolve) => {
        finish = () => {prep = JSON.parse(options.body as string); resolve(new Response(JSON.stringify(prep)));};
      });
      return new Response(JSON.stringify(url.endsWith("/prep") ? prep : stories));
    }));
    const user = userEvent.setup();
    render(withQueryClient(<InterviewPrep interviewId="7" />));
    await screen.findByText(prep.notes, {selector: "p"});
    await user.click(screen.getByText("Edit preparation"));
    const notes = screen.getByLabelText("Company research, questions to ask and prep notes");
    await user.type(notes, " More notes");
    await user.click(screen.getByRole("button", {name: "Save preparation"}));
    expect(notes).toBeDisabled();
    expect(screen.getByRole("checkbox", {name: "Conflict"})).toBeDisabled();
    await act(async () => finish());
    expect(await screen.findByRole("status")).toHaveTextContent("Preparation saved");
    expect(notes).toBeEnabled();
  });
});
