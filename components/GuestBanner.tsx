"use client";

import {usePathname} from "next/navigation";
import {SignedOut} from "@clerk/nextjs";

export default function GuestBanner() {
  // Recruiters opening an availability link aren't guests of the tracker
  if (usePathname().startsWith("/availability")) return null;

  return (
    <SignedOut>
      <div className="mb-4 rounded-md border border-dashed p-3 text-sm text-muted-foreground bg-muted/30">
        You are using Guest Mode. Your interviews are saved to this browser only and will sync to your account after you sign in.
      </div>
    </SignedOut>
  );
}
