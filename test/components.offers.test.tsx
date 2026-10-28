import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {userEvent} from "@testing-library/user-event";
import Offers, {OfferReminders, OffersLink} from "@/components/Offers";
import Calendar from "@/components/Calendar";
import {OfferSummary} from "@/lib/offers";
import {localDay} from "@/lib/searchReport";
import {withQueryClient} from "./utils";

vi.mock("next/navigation", () => ({useRouter: () => ({refresh: vi.fn(), push: vi.fn()})}));
let offers: OfferSummary[];
let fail: boolean;
const makeOffer = (deadline: string | null, interviewId = 10): OfferSummary => ({applicationId: 1, interviewId, jobTitle: "Engineer", company: "Client", agency: "Agency", interviewer: "Jane", outcome: "OFFER_RECEIVED", deadline});
const writes = () => vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method === "PUT");
beforeEach(() => {
  offers = [makeOffer("2020-01-01")]; fail = false;
  vi.stubGlobal("fetch", vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === "PUT") {
      if (fail) return Response.json({message: "Please refresh and try again"}, {status: 409});
      const body = JSON.parse(options.body as string);
      if (body.decision) offers = [];
      else offers = offers.map((offer) => ({...offer, deadline: body.deadline}));
      return Response.json({saved: true});
    }
    return Response.json(offers);
  }));
});
afterEach(() => vi.unstubAllGlobals());
describe("offer deadlines", () => {
  it("keeps expired offers visible and saves or clears the optional day", async () => {
    const user = userEvent.setup();
    render(withQueryClient(<Offers />));
    expect(await screen.findByText(/Respond by 2020-01-01/)).toHaveTextContent(/overdue/i);
    await user.click(screen.getByRole("button", {name: "Edit respond-by date"}));
    fireEvent.change(screen.getByLabelText("Respond by (optional)"), {target: {value: "2027-01-06"}});
    await user.click(screen.getByRole("button", {name: "Save deadline"}));
    expect(await screen.findByText(/Respond by 2027-01-06/)).toBeVisible();
    expect(JSON.parse(writes()[0][1]!.body as string)).toEqual({deadline: "2027-01-06"});
    await user.click(screen.getByRole("button", {name: "Edit respond-by date"}));
    fireEvent.change(screen.getByLabelText("Respond by (optional)"), {target: {value: ""}});
    await user.click(screen.getByRole("button", {name: "Save deadline"}));
    expect(await screen.findByText("No respond-by date")).toBeVisible();
    expect(JSON.parse(writes()[1][1]!.body as string)).toEqual({deadline: null});
  });
  it("preserves the edited date if a concurrent update prevents saving", async () => {
    const user = userEvent.setup(); fail = true;
    render(withQueryClient(<Offers />));
    await user.click(await screen.findByRole("button", {name: "Edit respond-by date"}));
    fireEvent.change(screen.getByLabelText("Respond by (optional)"), {target: {value: "2027-01-06"}});
    await user.click(screen.getByRole("button", {name: "Save deadline"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please refresh");
    expect(screen.getByLabelText("Respond by (optional)")).toHaveValue("2027-01-06");
  });
  it.each([['Accept', 'accepted', 'OFFER_ACCEPTED'], ['Decline', 'declined', 'OFFER_DECLINED']])("keeps copying a %s message separate from recording the decision", async (verb, recorded, decision) => {
    const user = userEvent.setup();
    const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(withQueryClient(<Offers />));
    await user.click(await screen.findByRole("button", {name: `${verb} offer message`}));
    const message = screen.getByLabelText("Message to send");
    expect((message as HTMLTextAreaElement).value).toContain("Client");
    await user.type(message, " Personal note");
    await user.click(screen.getByRole("button", {name: "Copy message"}));
    expect(clipboard).toHaveBeenCalledWith(expect.stringContaining("Personal note"));
    expect(writes()).toHaveLength(0);
    await user.click(screen.getByRole("button", {name: `Record ${recorded}`}));
    expect(await screen.findByText(/No open offers/)).toBeVisible();
    expect(JSON.parse(writes()[0][1]!.body as string)).toEqual({decision, confirmDecision: true});
  });
  it("reminds a day before, on the day and after it, and leaves unknown dates out", async () => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const later = new Date(); later.setDate(later.getDate() + 3);
    offers = [makeOffer("2020-01-01"), makeOffer(localDay(new Date()), 20), makeOffer(localDay(tomorrow), 30), makeOffer(localDay(later), 40), makeOffer(null, 50)];
    render(withQueryClient(<><OfferReminders /><OffersLink /></>));
    expect(await screen.findByLabelText("3 offer replies due")).toBeVisible();
    expect(screen.getAllByRole("link", {name: "Engineer · Client"})).toHaveLength(3);
    expect(screen.getByRole("link", {name: /Offers.*3 offer replies due/})).toHaveAttribute("href", "/offers");
  });
  it("shows calendar deadlines on the entered day west of UTC, excluding superseded offers", async () => {
    const day = localDay(new Date());
    const current = makeOffer(day);
    offers = [current];
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).includes('/api/offers')) return Response.json(offers);
      const stage = {stage: "Offer"};
      return Response.json([10, 20].map((id) => ({id, jobTitle: "Engineer", date: null, deadline: `${day}T00:00:00.000Z`, stage, company: {id: 1, name: "Acme"}, outcome: "OFFER_RECEIVED"})));
    });
    const {container} = render(withQueryClient(<Calendar />));
    await waitFor(() => expect(container.querySelector(`.day-${new Date().getDate()} .rounded-full`)).toBeInTheDocument());
    expect(container.querySelectorAll('.day-1 .rounded-full, [class*="day-"] .rounded-full')).toHaveLength(1);
  });
});
