"use client";

import {useEffect, useRef} from "react";
import {useUser} from "@clerk/nextjs";
import {clearGuestInterviews, listGuestInterviews} from "@/lib/guestStorage";


export default function GuestSync() {
  const { user } = useUser();
  const syncedRef = useRef(false);

  useEffect(() => {
    async function run() {
      if (!user || syncedRef.current) return;
      const locals = listGuestInterviews();
      if (!locals.length) return;
      // Create on server (companies are created implicitly by /api/interviews upsert)
      for (const g of locals) {
        try {
          const dateISO = g.date ?? new Date().toISOString();
          const res = await fetch("/api/interviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              stage: g.stage,
              companyName: g.companyName,
              clientCompany: g.clientCompany,
              jobTitle: g.jobTitle,
              jobPostingLink: g.jobPostingLink,
              date: dateISO,
              interviewer: g.interviewer,
              locationType: g.locationType,
              interviewLink: g.interviewLink,
            }),
          });
          if (!res.ok) {
            // Stop on first error to avoid duplicates; try again on next login
            console.error("GuestSync: failed to create interview", await res.text());
            return;
          }
        } catch (e) {
          console.error("GuestSync error", e);
          return;
        }
      }
      clearGuestInterviews();
      syncedRef.current = true;
    }
    run();
  }, [user]);

  return null;
}
