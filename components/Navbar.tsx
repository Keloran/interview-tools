"use client";

import Link from "next/link";
import {Trash2} from "lucide-react";
import {SignedIn, SignedOut, SignInButton, UserButton} from "@clerk/nextjs";
import {Button} from "@/components/ui/button";
import {Companies} from "@/components/Company";
import {useDueFollowUps} from "@/components/FollowUps";

// Client side on purpose: the server versions of SignedIn/SignedOut call auth(), which throws on
// requests the proxy matcher skips (anything that looks like a static file), turning a 404 into a 500
export default function Navbar() {
  return (
    <>
      <Companies />
      <Button asChild variant="ghost">
        <Link href="/roadmap">Roadmap</Link>
      </Button>
      <SignedOut>
        <SignInButton>
          <Button className={"cursor-pointer"}>Sign In</Button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <Button asChild variant="ghost">
          <Link href="/companies">Companies</Link>
        </Button>
        <NoFeedbackLink />
        <UserButton>
          <UserButton.MenuItems>
            <UserButton.Link label="Delete account" labelIcon={<Trash2 className="h-4 w-4" />} href="/deleteme" />
          </UserButton.MenuItems>
        </UserButton>
      </SignedIn>
    </>
  );
}

// Shows how many applications are due a follow-up
function NoFeedbackLink() {
  const {data} = useDueFollowUps();
  return (
    <Button asChild variant="ghost">
      <Link href="/no-feedback">
        No Feedback
        {!!data?.length && (
          <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground" aria-label={`${data.length} due a follow-up`}>
            {data.length}
          </span>
        )}
      </Link>
    </Button>
  );
}
