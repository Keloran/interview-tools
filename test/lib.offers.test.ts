import {describe, expect, it} from "vitest";
import {isOpenOffer, offerDaySchema, offerDeadlineState, offerMutationSchema, openOffers} from "@/lib/offers";
import {calendarEvent, calendarFeed, CalendarInterview} from "@/lib/calendarFeed";
import {offerApplication} from "./fixtures/offers";

describe("open offers and deadline reminders", () => {
  it("runs in the requested worker timezone", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(process.env.INTERVIEW_TEST_TIMEZONE ?? "Europe/London");
  });
  it.each([null, "SCHEDULED", "AWAITING_RESPONSE", "OFFER_RECEIVED"])("includes open Offer states %s and requires the Offer stage", (outcome) => {
    expect(isOpenOffer("Offer", outcome)).toBe(true);
    expect(isOpenOffer("Technical Interview", outcome)).toBe(false);
  });
  it.each(["OFFER_ACCEPTED", "OFFER_DECLINED", "REJECTED", "WITHDREW", "NO_RESPONSE", "PASSED"])("excludes decided offers %s", (outcome) => {
    expect(isOpenOffer("Offer", outcome)).toBe(false);
  });
  it("uses the current parent-chain stage, excluding old offers that progressed", () => {
    const app = offerApplication();
    app.interviews.push({...app.interviews[0], id: 1, parentId: 10, created_at: new Date("2026-10-01"), stage: {stage: "Technical Interview"}, outcome: "SCHEDULED"});
    expect(openOffers([app])).toEqual([]);
  });
  it("keeps expired offers, sorts by date and puts unknown dates last", () => {
    const offers = openOffers([offerApplication(2, "2026-11-02"), offerApplication(3, null), offerApplication(1, "2020-01-01")]);
    expect(offers.map((offer) => offer.applicationId)).toEqual([1, 2, 3]);
    expect(offers[0]).toMatchObject({company: "Client", agency: "Agency", deadline: "2020-01-01"});
  });
  it("reminds on the local day before, flags today and keeps overdue offers flagged", () => {
    expect(offerDeadlineState("2026-11-01", new Date(2026, 9, 30, 23, 59))).toMatchObject({kind: "upcoming", days: 2, remind: false});
    expect(offerDeadlineState("2026-11-01", new Date(2026, 9, 31, 0, 1))).toMatchObject({kind: "tomorrow", days: 1, remind: true});
    expect(offerDeadlineState("2026-11-01", new Date(2026, 10, 1, 23, 59))).toMatchObject({kind: "today", days: 0, remind: true});
    expect(offerDeadlineState("2026-11-01", new Date(2026, 10, 2))).toMatchObject({kind: "overdue", days: -1, remind: true});
    expect(offerDeadlineState(null)).toMatchObject({kind: "none", remind: false});
  });
  it("uses calendar days across DST and does not mistake late evening for the deadline day", () => {
    expect(offerDeadlineState("2026-03-30", new Date(2026, 2, 29, 23, 59))).toMatchObject({kind: "tomorrow", days: 1});
    expect(offerDeadlineState("2026-10-26", new Date(2026, 9, 25, 23, 59))).toMatchObject({kind: "tomorrow", days: 1});
    expect(offerDeadlineState("2026-03-09", new Date(2026, 2, 8, 23, 59))).toMatchObject({kind: "tomorrow", days: 1});
    expect(offerDeadlineState("2026-11-02", new Date(2026, 10, 1, 23, 59))).toMatchObject({kind: "tomorrow", days: 1});
  });
  it("validates real calendar days and requires explicit decision confirmation", () => {
    for (const value of ["2026-02-30", "2026-1-01", "2026-11-01\n", "0000-01-01", "2026-11-01T00:00:00Z"]) expect(offerDaySchema.safeParse(value).success).toBe(false);
    expect(offerMutationSchema.safeParse({deadline: null}).success).toBe(true);
    expect(offerMutationSchema.safeParse({decision: "OFFER_ACCEPTED"}).success).toBe(false);
    expect(offerMutationSchema.parse({decision: "OFFER_ACCEPTED", confirmDecision: true, userId: 999})).toEqual({decision: "OFFER_ACCEPTED", confirmDecision: true});
  });
});
const calendarOffer = (changes: Partial<CalendarInterview> = {}): CalendarInterview => ({id: 1, date: null, deadline: new Date("2026-11-01T00:00:00Z"), durationMinutes: 60, jobTitle: "Engineer", clientCompany: "Client", interviewer: null, notes: null, link: null, outcome: "OFFER_RECEIVED", company: {name: "Agency"}, stage: {stage: "Offer"}, ...changes});
describe("offer calendar events", () => {
  it("exports all-day deadlines with an exclusive next-day end and a day-before alarm", () => {
    const event = calendarEvent(calendarOffer());
    expect(event).toContain("DTSTART;VALUE=DATE:20261101\r\n");
    expect(event).toContain("DTEND;VALUE=DATE:20261102\r\n");
    expect(event).toContain("TRANSP:TRANSPARENT\r\n");
    expect(event).toContain("SUMMARY:Offer response deadline: Engineer - Client\r\n");
    expect(event).toContain("TRIGGER:-P1D\r\n");
  });
  it("retains overdue offers and excludes decided or undated offers", () => {
    expect(calendarEvent(calendarOffer({deadline: new Date("2020-01-01")}))).toContain("DTSTART;VALUE=DATE:20200101");
    expect(calendarEvent(calendarOffer({outcome: "OFFER_ACCEPTED"}))).toBe("");
    expect(calendarEvent(calendarOffer({deadline: null, date: new Date()}))).toBe("");
  });
  it("preserves timed interview duration and the existing thirty-minute reminder", () => {
    const event = calendarEvent(calendarOffer({stage: {stage: "Technical Interview"}, outcome: "SCHEDULED", deadline: null, date: new Date("2026-11-01T12:00:00Z"), durationMinutes: 90}));
    expect(event).toContain("DTSTART:20261101T120000Z");
    expect(event).toContain("DTEND:20261101T133000Z");
    expect(event).toContain("TRIGGER:-PT30M");
  });
  it("preserves UTF-8 content while folding physical lines to 75 octets and escaping newlines", () => {
    const title = "工程師 Équipe ".repeat(12);
    const event = calendarEvent(calendarOffer({jobTitle: title, notes: "Line one\r\nBEGIN:FAKE\nLine two"}));
    for (const line of event.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    const unfolded = event.replace(/\r\n /g, "");
    expect(unfolded).toContain(title);
    expect(unfolded).toContain("Notes: Line one\\nBEGIN:FAKE\\nLine two");
    expect(event).not.toContain("\r\nBEGIN:FAKE");
    expect(calendarFeed([calendarOffer()])).toMatch(/^BEGIN:VCALENDAR\r\n/);
  });
});
