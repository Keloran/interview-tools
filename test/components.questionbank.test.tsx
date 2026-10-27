import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import {userEvent} from "@testing-library/user-event";
import QuestionBank, {PreviousQuestions} from "@/components/QuestionBank";
import {withQueryClient} from "./utils";

const entry = (id: number, company = "Acme", stage = "Technical") => ({interviewId: id, company, stage, recruiter: "Recruit Co", date: "2026-01-01", jobTitle: "Engineer", questions: [`Question ${id}?`], notes: "I explained my delivery example"});
beforeEach(() => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([entry(1), entry(2, "Other", "Phone Screen")])))));
afterEach(() => vi.unstubAllGlobals());

describe("question bank UI", () => {
  it("browses notes and filters by company, stage and free text", async () => {
    const user = userEvent.setup();
    render(withQueryClient(<QuestionBank />));
    await screen.findByText("Question 1?");
    await user.selectOptions(screen.getByLabelText("Company"), "Other");
    expect(screen.queryByText("Question 1?")).not.toBeInTheDocument();
    expect(screen.getByText("Question 2?")).toBeInTheDocument();
    expect(screen.getByText("I explained my delivery example")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Stage"), "Technical");
    expect(screen.getByRole("status")).toHaveTextContent("No questions match");
    await user.selectOptions(screen.getByLabelText("Company"), "");
    await user.selectOptions(screen.getByLabelText("Stage"), "");
    await user.type(screen.getByLabelText("Search questions and notes"), "Question 2");
    expect(screen.queryByText("Question 1?")).not.toBeInTheDocument();
  });
  it("paginates and resets after a filter changes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(Array.from({length: 21}, (_, i) => entry(i + 1))))));
    const user = userEvent.setup();
    render(withQueryClient(<QuestionBank />));
    await screen.findByText("Question 1?");
    expect(screen.queryByText("Question 21?")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", {name: "Next"}));
    expect(screen.getByText("Question 21?")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search questions and notes"), "Question 1?");
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    expect(screen.getByText("Question 1?")).toBeInTheDocument();
  });
  it("shows context before a matching interview", async () => {
    render(withQueryClient(<PreviousQuestions interviewId={10} company="Acme" stage="Technical" date="2026-12-01" />));
    expect(await screen.findByText("Last time Acme asked at Technical")).toBeInTheDocument();
    expect(screen.queryByText("Question 2?")).not.toBeInTheDocument();
  });
  it("explains how to start an empty bank", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]")));
    render(withQueryClient(<QuestionBank />));
    expect(await screen.findByText(/Record questions in an interview debrief/)).toBeInTheDocument();
  });
  it("reports failed loading rather than an empty bank", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", {status: 500})));
    render(withQueryClient(<QuestionBank />));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your questions");
  });
});
