"use client";

import {useEffect} from "react";
import {Button} from "@/components/ui/button";
import {reportClientError} from "@/lib/reportClientError";

export default function ErrorPage({error, reset}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // errors with a digest came from the server and were already reported by onRequestError
    if (!error.digest) reportClientError("Render error", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground">It&apos;s been reported. Try again, or refresh the page.</p>
      <Button className="cursor-pointer" onClick={reset}>Try again</Button>
    </div>
  );
}
