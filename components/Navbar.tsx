"use client";

import {useState} from "react";
import Link from "next/link";
import {Menu, Trash2, X} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {SignedIn, SignedOut, SignInButton, UserButton} from "@clerk/nextjs";
import {Button} from "@/components/ui/button";
import {Companies} from "@/components/Company";
import {useDueFollowUps} from "@/components/FollowUps";
import {cn} from "@/lib/utils";

// Client side on purpose: the server versions of SignedIn/SignedOut call auth(), which throws on
// requests the proxy matcher skips (anything that looks like a static file), turning a 404 into a 500
export default function Navbar() {
  return (
    <nav className="flex shrink-0 items-center gap-2">
      {/* Wide screens: everything inline */}
      <div className="hidden xl:flex items-center gap-2">
        <Companies />
        <NavLinks />
      </div>
      <SignedIn>
        <UserButton>
          <UserButton.MenuItems>
            <UserButton.Link label="Delete account" labelIcon={<Trash2 className="h-4 w-4" />} href="/deleteme" />
          </UserButton.MenuItems>
        </UserButton>
      </SignedIn>
      {/* Phones: the rest goes in a drawer */}
      <MobileMenu />
    </nav>
  );
}

// stacked: full-width rows for the drawer; onNavigate closes it
function NavLinks({stacked, onNavigate}: { stacked?: boolean; onNavigate?: () => void }) {
  const item = cn("cursor-pointer", stacked && "w-full justify-start text-base h-11");
  return (
    <>
      <SignedIn>
        <Button asChild variant="ghost" className={item}>
          <Link href="/companies" onClick={onNavigate}>Companies</Link>
        </Button>
        <NoFeedbackLink className={item} onClick={onNavigate} />
        <Button asChild variant="ghost" className={item}>
          <Link href="/questions" onClick={onNavigate}>Questions</Link>
        </Button>
        <Button asChild variant="ghost" className={item}>
          <Link href="/stories" onClick={onNavigate}>Stories</Link>
        </Button>
        <Button asChild variant="ghost" className={item}>
          <Link href="/data" onClick={onNavigate}>Your data</Link>
        </Button>
      </SignedIn>
      <Button asChild variant="ghost" className={item}>
        <Link href="/roadmap" onClick={onNavigate}>Roadmap</Link>
      </Button>
      <SignedOut>
        <SignInButton>
          <Button className={cn("cursor-pointer", stacked && "w-full h-11")}>Sign In</Button>
        </SignInButton>
      </SignedOut>
    </>
  );
}

function MobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="ghost" size="icon" className="relative xl:hidden cursor-pointer" aria-label="Menu">
          <Menu />
          <SignedIn><FollowUpDot /></SignedIn>
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col gap-1 overflow-y-auto border-l bg-background p-4 shadow-lg data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right">
          <div className="mb-2 flex items-center justify-between">
            <DialogPrimitive.Title className="font-semibold">Menu</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" className="cursor-pointer" aria-label="Close menu">
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">Site navigation</DialogPrimitive.Description>
          <div className="mb-2 [&_input]:w-full">
            <Companies />
          </div>
          <NavLinks stacked onNavigate={() => setOpen(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// Follow-ups are due: shown on the menu button so they aren't hidden behind it
function FollowUpDot() {
  const {data} = useDueFollowUps();
  return data?.length ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" aria-label="Follow-ups due" /> : null;
}

// Shows how many applications are due a follow-up
function NoFeedbackLink({className, onClick}: { className?: string; onClick?: () => void }) {
  const {data} = useDueFollowUps();
  return (
    <Button asChild variant="ghost" className={className}>
      <Link href="/no-feedback" onClick={onClick}>
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
