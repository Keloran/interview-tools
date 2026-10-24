"use client";

import {useEffect} from "react";
import {reportClientError} from "@/lib/reportClientError";

// Errors in the root layout itself; replaces the whole document, so no app styles here
export default function GlobalError({error, reset}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (!error.digest) reportClientError("Root layout error", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "3rem"}}>
        <h2>Something went wrong</h2>
        <p>It&apos;s been reported.</p>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
