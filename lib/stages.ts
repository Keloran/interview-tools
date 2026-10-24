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

export function sortStages<T extends { stage: string }>(stages: T[]): T[] {
  return [...stages].sort((a, b) => rank(a.stage) - rank(b.stage) || a.stage.localeCompare(b.stage));
}
