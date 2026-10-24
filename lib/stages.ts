// Stages in the order an application goes through them; anything custom sits before Offer
const STAGE_ORDER = [
  "Applied",
  "Phone Screen",
  "First Stage",
  "Technical Test",
  "Technical Interview",
  "Second Stage",
  "Third Stage",
  "Fourth Stage",
  "Final Stage",
  "Offer",
];
const CUSTOM = STAGE_ORDER.indexOf("Offer") - 0.5;

const rank = (stage: string) => {
  const i = STAGE_ORDER.findIndex((s) => s.toLowerCase() === stage.trim().toLowerCase());
  return i === -1 ? CUSTOM : i;
};

const compare = (a: string, b: string) => rank(a) - rank(b) || a.localeCompare(b, undefined, {sensitivity: "base"});

export function sortStages<T extends { stage: string }>(stages: T[]): T[] {
  return [...stages].sort((a, b) => compare(a.stage, b.stage));
}

// The stage that logically follows `current` (e.g. Phone Screen -> First Stage); none after Offer
export function nextStage(current: string | undefined, stages: { stage: string }[]): string | undefined {
  if (!current) return undefined;
  return sortStages(stages).find((s) => compare(s.stage, current) > 0)?.stage;
}
