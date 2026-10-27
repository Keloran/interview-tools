"use client";

import {useEffect, useRef, useState} from "react";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {buildJobBookmarklet} from "@/lib/listingImport";

export default function JobBookmarklet() {
  const link = useRef<HTMLAnchorElement>(null);
  const code = useRef("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    code.current = buildJobBookmarklet(window.location.origin);
    // Assign our generated, trusted bookmark URL after mount; React blocks javascript: hrefs.
    link.current?.setAttribute("href", code.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code.current);
      setMessage("Copied. Paste into the saved bookmark’s URL or Location field, then save it. Use the saved bookmark from a job listing.");
    } catch {
      setMessage("Copy was unavailable. Drag “Check this job” to your bookmarks bar instead.");
    }
  }

  return <Card className="p-4 gap-3">
    <h2 className="font-semibold">Check jobs from other sites</h2>
    <p className="text-sm text-muted-foreground">Drag “Check this job” to your bookmarks bar. When viewing a job listing, click that bookmark to open its application check here.</p>
    <div className="flex flex-wrap items-center gap-3">
      <a ref={link} href="#" draggable className="cursor-grab rounded-md border px-3 py-2 text-sm font-medium" onClick={(event) => {
        event.preventDefault();
        setMessage("Drag this link to your bookmarks bar, then use it from a job listing.");
      }}>Check this job</a>
    </div>
    <details className="text-sm">
      <summary className="cursor-pointer font-medium">Install manually instead</summary>
      <ol className="mt-3 list-decimal space-y-3 pl-5">
        <li>In your browser’s bookmark manager, create a bookmark named “Check this job”.</li>
        <li>
          <p className="mb-2">Copy the bookmark URL below. Edit the bookmark and paste it into its <strong>URL or Location field</strong>. Pasting it into the browser’s address/search bar will run a search instead.</p>
          <Button variant="outline" onClick={copy}>Copy bookmark URL</Button>
        </li>
        <li>Save the bookmark. Open a job listing, then click the saved “Check this job” bookmark.</li>
      </ol>
    </details>
    <p className="text-xs text-muted-foreground">If your browser or the job site blocks the bookmark, paste the job link above. Job details are suggestions you can edit before saving.</p>
    {message && <p role="status" className="text-sm">{message}</p>}
  </Card>;
}
