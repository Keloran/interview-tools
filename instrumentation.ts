import type {Instrumentation} from "next";
import {reportError} from "@/lib/bugfixes";

// Anything a page, route handler or server action throws without catching
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  // method/path/route only: no headers, cookies or bodies
  reportError(`${request.method} ${request.path} failed`, `(${context.routeType} ${context.routePath})`, err);
};
