const SYNONYMS = new Map([
  ["sr", "senior"],
  ["snr", "senior"],
  ["jr", "junior"],
  ["eng", "engineer"],
  ["dev", "engineer"],
  ["developer", "engineer"],
]);

// Remove listing decorations, retaining role, seniority and technology names.
export function normalizeJobTitle(title: string): string {
  return title.toLowerCase()
    .replace(/\(\s*m\s*\/\s*f\s*\/\s*d\s*\)/g, " ")
    .replace(/(?:\s*[-–—|]\s*remote|\s*\(\s*remote\s*\))\s*$/, "")
    .replace(/\b(back|front)[\s\p{Pd}]+end\b/gu, "$1end")
    .replace(/\bfull[\s\p{Pd}]+stack\b/gu, "fullstack")
    .replace(/\p{Pd}/gu, " ")
    .replace(/\b(sr|snr|jr|eng|dev)\./g, "$1")
    .trim().split(/\s+/)
    .map((word) => SYNONYMS.get(word) ?? word)
    .join(" ");
}

export function jobTitlesMatch(first: string, second: string): boolean {
  const a = normalizeJobTitle(first);
  const b = normalizeJobTitle(second);
  // Keep partial role searches, but require complete words rather than substrings.
  return !!a && !!b && (` ${a} `.includes(` ${b} `) || ` ${b} `.includes(` ${a} `));
}
