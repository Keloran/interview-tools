import type {Instrumentation} from "next";
import {reportError} from "@/lib/bugfixes";

// At boot and hourly after, every user goes to ChewedFeed HQ as a customer (see lib/chewedfeed)
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const {syncAllCustomers} = await import("@/lib/chewedfeed");
  void syncAllCustomers();
  setInterval(() => void syncAllCustomers(), 60 * 60 * 1000).unref();
}

// Anything a page, route handler or server action throws without catching
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  // The app has no server actions, so these only come from bots probing for them (or a tab left open over a deploy):
  // a stale action id, or a junk POST body Next tries to parse as action FormData
  if (err instanceof Error && /^Failed to (find Server Action|parse body as FormData)/.test(err.message)) return;
  // method/path/route only: no headers, cookies or bodies
  reportError(`${request.method} ${request.path} failed`, `(${context.routeType} ${context.routePath})`, err);
};
