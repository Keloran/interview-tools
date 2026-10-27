"use client";

import Link from "next/link";
import {SignedIn, SignedOut, SignInButton, UserButton} from "@clerk/nextjs";
import {Button} from "@/components/ui/button";
import {Companies} from "@/components/Company";

// Client side on purpose: the server versions of SignedIn/SignedOut call auth(), which throws on
// requests the proxy matcher skips (anything that looks like a static file), turning a 404 into a 500
export default function Navbar() {
  return (
    <>
      <Companies />
      <SignedOut>
        <SignInButton>
          <Button className={"cursor-pointer"}>Sign In</Button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <Button asChild variant="ghost">
          <Link href="/no-feedback">No Feedback</Link>
        </Button>
        <UserButton />
      </SignedIn>
    </>
  );
}
