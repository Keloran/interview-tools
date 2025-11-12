// Utilities for storing guest (signed-out) data in localStorage
// Schema versioning allows future migrations

export type GuestInterview = {
  id: string; // temp id
  stage: string;
  companyName: string;
  clientCompany?: string;
  jobTitle: string;
  jobPostingLink?: string;
  date?: string; // ISO (for Technical Test this represents the deadline)
  time?: string; // HH:mm:ss
  interviewer?: string;
  locationType?: "phone" | "link";
  interviewLink?: string;
  notes?: string;
  createdAt: string; // ISO
  // Simple dedupe hash: companyName|jobTitle|date|time
  hash: string;
};

export type GuestStorage = {
  version: 1;
  interviews: GuestInterview[];
};

const KEY = "guest_interviews_v1";

function safeParse<T>(raw: string | null): T | null {
  try {
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadGuest(): GuestStorage {
  const parsed = safeParse<GuestStorage>(
    typeof window !== "undefined" ? localStorage.getItem(KEY) : null
  );
  if (!parsed || parsed.version !== 1) {
    return { version: 1, interviews: [] };
  }
  return parsed;
}

function emitChanged() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("guest:interviews:changed"));
  } catch {}
}

export function saveGuest(data: GuestStorage) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(data));
  emitChanged();
}

function makeHash(i: Omit<GuestInterview, "id" | "createdAt" | "hash">): string {
  const date = i.date ?? "";
  const time = i.time ?? "";
  const parts = [i.companyName?.trim().toLowerCase(), i.jobTitle?.trim().toLowerCase(), date, time];
  return parts.join("|");
}

export function addGuestInterview(input: Omit<GuestInterview, "id" | "createdAt" | "hash">): GuestInterview {
  const current = loadGuest();
  const hash = makeHash(input);
  const exists = current.interviews.find((x) => x.hash === hash);
  if (exists) return exists;
  const id = `guest_${Math.random().toString(36).slice(2, 10)}`;
  const createdAt = new Date().toISOString();
  const item: GuestInterview = { id, createdAt, hash, ...input };
  current.interviews.push(item);
  saveGuest(current);
  return item;
}

export function listGuestInterviews(): GuestInterview[] {
  return loadGuest().interviews;
}

export function removeGuestInterview(id: string) {
  const current = loadGuest();
  const next = { ...current, interviews: current.interviews.filter((i) => i.id !== id) };
  saveGuest(next);
}

export function clearGuestInterviews() {
  saveGuest({ version: 1, interviews: [] });
}
