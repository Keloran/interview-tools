import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen, within} from "@testing-library/react";
import {userEvent} from "@testing-library/user-event";
import {OfferComparison, CompensationEditor} from "@/components/Compensation";
import Offers from "@/components/Offers";
import {openOffers} from "@/lib/offers";
import {offerApplication} from "./fixtures/offers";
import {withQueryClient} from "./utils";
beforeEach(() => vi.stubGlobal("fetch", vi.fn(async () => Response.json({saved: true}))));
afterEach(() => vi.unstubAllGlobals());
describe("offer comparison", () => {
  it("compares current open offers in deadline order, preserving currency and pay periods", async () => {
    const later = offerApplication(2, "2026-11-03"); later.company.name = "Beta"; later.clientCompany = null; later.interviews[0].offerBase = "$8,000/month";
    const expired = offerApplication(1, "2020-01-01"); expired.advertisedSalary = "£70–80k/year"; expired.interviews[0].offerBase = "£75k/year";
    const closed = offerApplication(3); closed.interviews[0].outcome = "OFFER_DECLINED"; closed.jobTitle = "Closed role";
    vi.mocked(fetch).mockResolvedValue(Response.json(openOffers([later, closed, expired])));
    render(withQueryClient(<Offers />));
    const table = await screen.findByRole("table");
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual(["Details", "Engineer · ClientVia Agency", "Engineer · Beta"]);
    expect(within(table).getByText("£70–80k/year")).toBeVisible();
    expect(within(table).getByText("£75k/year")).toBeVisible();
    expect(within(table).getByText("$8,000/month")).toBeVisible();
    expect(within(table).getAllByText("Not recorded").length).toBeGreaterThan(0);
    expect(screen.queryByText("Closed role")).not.toBeInTheDocument();
    expect(screen.getByText(/Respond by 2020-01-01/)).toHaveTextContent(/Overdue/);
  });
  it("does not show a comparison for an empty set", () => {
    render(<OfferComparison offers={[]} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
  it("preserves drafts after errors, and saves optional values only on explicit save", async () => {
    const user = userEvent.setup(), saved = vi.fn(), cancelled = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({message: "Please retry"}, {status: 500})).mockResolvedValue(Response.json({saved: true}));
    render(withQueryClient(<CompensationEditor interviewId={10} value={{offerBase: "£75k/year"}} isOffer onSaved={saved} onCancel={cancelled} />));
    await user.type(screen.getByLabelText("Benefits"), "Remote budget");
    expect(fetch).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", {name: "Save salary details"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please retry");
    expect(screen.getByLabelText("Benefits")).toHaveValue("Remote budget");
    expect(saved).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", {name: "Save salary details"}));
    expect(saved).toHaveBeenCalledOnce();
    expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string)).toMatchObject({offerBase: "£75k/year", offerBonus: null, offerBenefits: "Remote budget", advertisedSalary: null});
  });
  it("allows editing an advertised range before the Offer stage", async () => {
    const user = userEvent.setup(), saved = vi.fn();
    render(withQueryClient(<CompensationEditor interviewId={10} value={{advertisedSalary: "£70–80k/year"}} isOffer={false} onSaved={saved} onCancel={vi.fn()} />));
    expect(screen.queryByLabelText("Base salary")).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("Advertised salary range"));
    await user.click(screen.getByRole("button", {name: "Save salary details"}));
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({advertisedSalary: null});
  });
});
