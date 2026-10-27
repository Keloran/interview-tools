import type {Instrumentation} from "next";
import {reportError} from "@/lib/bugfixes";

// Anything a page, route handler or server action throws without catching
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  // The app has no server actions, so this only comes from bots probing for them (or a tab left open over a deploy)
  if (err instanceof Error && err.message.startsWith("Failed to find Server Action")) return;
  // method/path/route only: no headers, cookies or bodies
  reportError(`${request.method} ${request.path} failed`, `(${context.routeType} ${context.routePath})`, err);
};
