import {z} from "zod";

export const COMMUNITY_NOTICE_VERSION = "2026-10-28-v1";
export const COMMUNITY_LIMITS = {contributors: 20, binaryCell: 5, windowMonths: 24, delayDays: 30} as const;
export function noticeIdentity() {
  const name = (process.env.COMMUNITY_OPERATOR_NAME ?? "Keloran LTD").trim();
  const email = (process.env.COMMUNITY_PRIVACY_EMAIL ?? "compliance@chewedfeed.com").trim();
  return name && z.string().email().safeParse(email).success ? {name, email: email!} : null;
}
export type ReleaseControl = {noticeVersion: string | null; noticePublishedAt: Date | null; collectionEnabled: boolean; publicationEnabled: boolean; revocationEpoch: number};
export type ConsentChoice = {noticeVersion: string; grantedAt: Date | null; withdrawnAt: Date | null; revision: number; purgePending: boolean; quarantinedAt?: Date | null};
export function noticePublished(control: ReleaseControl | null, now = new Date()) {
  return !!noticeIdentity() && control?.noticeVersion === COMMUNITY_NOTICE_VERSION && !!control.noticePublishedAt && control.noticePublishedAt <= now;
}
export function collectionOpen(control: ReleaseControl | null, now = new Date()) {return noticePublished(control, now) && !!control?.collectionEnabled;}
export function consentCurrent(consent: ConsentChoice | null | undefined) {return !!consent?.grantedAt && !consent.withdrawnAt && !consent.purgePending && !consent.quarantinedAt && consent.noticeVersion === COMMUNITY_NOTICE_VERSION;}
export function snapshotCurrent(control: ReleaseControl | null, snapshot: {revocationEpoch: number; noticeVersion: string} | null, now = new Date()) {
  return collectionOpen(control, now) && !!control?.publicationEnabled && !!snapshot && snapshot.noticeVersion === COMMUNITY_NOTICE_VERSION && snapshot.revocationEpoch === control.revocationEpoch;
}
export const consentMutationSchema = z.discriminatedUnion("enabled", [
  z.object({enabled: z.literal(true), noticeVersion: z.literal(COMMUNITY_NOTICE_VERSION), confirm: z.literal(true)}),
  z.object({enabled: z.literal(false)}),
]);
