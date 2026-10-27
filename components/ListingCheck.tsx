"use client";

import {useSyncExternalStore} from "react";
import {SignInButton, useUser} from "@clerk/nextjs";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import HaveIApplied from "@/components/HaveIApplied";
import JobBookmarklet from "@/components/JobBookmarklet";
import {listingCheckPath, readListingImport} from "@/lib/listingImport";

const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};
const getFragment = () => window.location.hash;
const serverFragment = () => "";

export default function ListingCheck() {
  const {user, isLoaded} = useUser();
  const fragment = useSyncExternalStore(subscribe, getFragment, serverFragment);
  const imported = readListingImport(fragment);
  if (!isLoaded) return <p role="status">Loading your account…</p>;
  if (!user) {
    const returnTo = listingCheckPath(imported);
    return <Card className="p-4 gap-3">
      <h2 className="font-semibold">Check before you apply</h2>
      <p>Sign in to check your application history. Your imported job will be here when you return.</p>
      <SignInButton forceRedirectUrl={returnTo} signUpForceRedirectUrl={returnTo}>
        <Button>Sign in to check this job</Button>
      </SignInButton>
    </Card>;
  }
  return <div className="space-y-6">
    {fragment.startsWith("#job=") && !imported && <p role="alert" className="text-sm text-destructive">This job link could not be imported. Paste the link into the check below.</p>}
    <HaveIApplied key={fragment} withDescription initialListing={imported} />
    <JobBookmarklet />
  </div>;
}
