import {beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {userEvent} from "@testing-library/user-event";
import {useUser} from "@clerk/nextjs";
import {useQuery} from "@tanstack/react-query";
import {useFlags} from "@flags-gg/react-library";
import {listGuestInterviews, removeGuestInterview} from "@/lib/guestStorage";
import InterviewsList from "@/components/InterviewsList";

vi.mock("@clerk/nextjs", () => ({useUser: vi.fn()}));
vi.mock("@tanstack/react-query", () => ({useQuery: vi.fn(), useQueryClient: () => ({invalidateQueries: vi.fn()})}));
vi.mock("@flags-gg/react-library", () => ({useFlags: vi.fn()}));
vi.mock("@/lib/store", () => ({useAppStore: (selector: (state: object) => unknown) => selector({filteredDate: null, filteredCompany: null, filteredOutcome: null})}));
vi.mock("@/lib/guestStorage", () => ({listGuestInterviews: vi.fn(() => []), removeGuestInterview: vi.fn()}));
vi.mock("@/components/FreeTimes", () => ({default: () => null}));
vi.mock("@/components/InterviewInfo", () => ({default: () => <p>Interview info content</p>}));
vi.mock("@/components/InterviewEditForm", () => ({default: ({interviewId}: {interviewId: string}) => <input aria-label="Edit interview ID" defaultValue={interviewId} />}));
vi.mock("@/components/ShareAvailability", () => ({default: () => <input aria-label="Availability content" />}));
vi.mock("@/components/SendMessage", () => ({default: () => <input aria-label="Message content" />}));
vi.mock("@/components/FeedbackForm", () => ({default: () => <input aria-label="Feedback content" />}));

const row = {id: "7", jobTitle: "Backend Engineer", date: "2026-01-13T09:00:00Z", stage: {stage: "Phone Screen"}, company: {id: 1, name: "Example"}, outcome: "SCHEDULED"};
function show(overrides: Partial<typeof row> = {}) {
  vi.mocked(useQuery).mockImplementation((options: any) => ({data: options.queryKey[0] === "interviews" ? [{...row, ...overrides}] : []}) as any);
  render(<InterviewsList />);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useUser).mockReturnValue({user: {id: "user_123"}} as any);
  vi.mocked(useFlags).mockReturnValue({is: () => ({enabled: () => true})} as any);
});

describe("interview action menu", () => {
  it("opens and closes by keyboard without opening interview details", async () => {
    show();
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", {name: "More actions for Backend Engineer at Example"});
    expect(screen.getByRole("button", {name: "Progress interview to next stage"})).toBeVisible();
    expect(screen.getByRole("button", {name: "Debrief"})).toBeVisible();
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menuitem", {name: "Edit interview details"})).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it.each([
    ["Edit interview details", "Edit Interview - Backend Engineer", "Edit interview ID"],
    ["Share availability", "Share availability - Backend Engineer", "Availability content"],
    ["Send a message", "Send a message - Backend Engineer", "Message content"],
    ["Rejected", "Rejected - Backend Engineer", "Feedback content"],
  ])("opens %s from the menu without opening the card", async (action, title, input) => {
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", {name: /More actions/}));
    await user.click(screen.getByRole("menuitem", {name: action}));
    expect(await screen.findByRole("dialog", {name: title})).toBeVisible();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByLabelText(input)).toHaveFocus();
    expect(screen.queryByText("Interview info content")).not.toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("keeps rejected-only feedback and hides unavailable actions", async () => {
    show({outcome: "REJECTED"});
    const user = userEvent.setup();
    expect(screen.queryByRole("button", {name: "Progress interview to next stage"})).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", {name: /More actions/}));
    expect(screen.queryByRole("menuitem", {name: "Share availability"})).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", {name: "Rejected"})).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", {name: "Feedback"}));
    expect(await screen.findByRole("dialog", {name: "Feedback - Backend Engineer"})).toBeVisible();
  });

  it("preserves the edit feature flag", async () => {
    vi.mocked(useFlags).mockReturnValue({is: () => ({enabled: () => false})} as any);
    show();
    await userEvent.setup().click(screen.getByRole("button", {name: /More actions/}));
    expect(screen.queryByRole("menuitem", {name: "Edit interview details"})).not.toBeInTheDocument();
  });

  it("reopens a no-response application through the menu", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(Response.json({}));
    try {
      show({outcome: "NO_RESPONSE"});
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", {name: /More actions/}));
      await user.click(screen.getByRole("menuitem", {name: "Reopen application"}));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/interview/7", expect.objectContaining({method: "PUT", body: JSON.stringify({outcome: "AWAITING_RESPONSE"})})));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    } finally { fetchMock.mockRestore(); }
  });

  it("keeps guest deletion local and offers no server action menu", async () => {
    vi.mocked(useUser).mockReturnValue({user: null} as any);
    vi.mocked(listGuestInterviews).mockReturnValue([{id: "guest_7", jobTitle: "Guest role", companyName: "Example", date: "2026-01-13T09:00:00Z", stage: "Applied"}] as any);
    show();
    const user = userEvent.setup();
    expect(screen.queryByRole("button", {name: /More actions/})).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", {name: "Delete interview"}));
    expect(removeGuestInterview).toHaveBeenCalledWith("guest_7");
    expect(screen.queryByText(/Guest role - Example/)).not.toBeInTheDocument();
  });
});
