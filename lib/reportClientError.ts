import {error, setDefaultConfig} from "bugfixes";
import {env} from "@/lib/env";

// Browser side: reports straight to bugfixes with the browser key (never the agent secret).
// Without a key it just logs to the console.
setDefaultConfig({agentKey: env.NEXT_PUBLIC_BUGFIXES_BROWSER_KEY ?? "", service: "interview-tools"});

const MAX_PER_PAGE = 20; // a render loop shouldn't fire hundreds of reports
const seen = new Set<string>();

export function reportClientError(message: string, err?: unknown) {
  const detail = err instanceof Error ? err.message : err === undefined ? "" : String(err);
  const key = `${message}|${detail}`;
  if (seen.has(key) || seen.size >= MAX_PER_PAGE) {
    console.error(message, err);
    return;
  }
  seen.add(key);

  const where = typeof window === "undefined" ? "" : `(${window.location.pathname})`;
  error(`[browser] ${message}`, where, err ?? "");
}
