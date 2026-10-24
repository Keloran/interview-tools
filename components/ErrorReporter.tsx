"use client";

import {useEffect} from "react";
import {reportClientError} from "@/lib/reportClientError";

// Uncaught errors and unhandled promise rejections anywhere in the browser
export default function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportClientError("Uncaught error", e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reportClientError("Unhandled promise rejection", e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
