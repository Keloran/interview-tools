import {z} from "zod";

export const offerDetailLabels = {
  offerBase: "Base salary", offerBonus: "Bonus", offerEquity: "Equity", offerBenefits: "Benefits", offerNotice: "Notice period", offerLocation: "Location / working pattern",
} as const;
export type OfferDetailKey = keyof typeof offerDetailLabels;
export const offerDetailKeys = Object.keys(offerDetailLabels) as OfferDetailKey[];
const text = z.string().trim().max(2000).nullable();
export const compensationSchema = z.object({advertisedSalary: z.string().trim().max(500).nullable().optional(),
  offerBase: text.optional(), offerBonus: text.optional(), offerEquity: text.optional(), offerBenefits: text.optional(), offerNotice: text.optional(), offerLocation: text.optional(),
}).refine((value) => Object.keys(value).length > 0, "Enter a salary range or offer details");
export type Compensation = {advertisedSalary?: string | null} & Partial<Record<OfferDetailKey, string | null>>;
export const compensationSelect = {offerBase: true, offerBonus: true, offerEquity: true, offerBenefits: true, offerNotice: true, offerLocation: true} as const;
export const cleanCompensation = (value: Compensation) => Object.fromEntries(Object.entries(value).map(([key, text]) => [key, text?.trim() || null])) as Compensation;
