"use client";

import {useState} from "react";
import Link from "next/link";
import {SignedIn, SignedOut, useClerk} from "@clerk/nextjs";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {clearGuestInterviews} from "@/lib/guestStorage";
import {reportClientError} from "@/lib/reportClientError";
import {DELETE_CONFIRMATION as CONFIRMATION} from "@/lib/account";

function DeleteForm() {
  const {signOut} = useClerk();
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = typed.trim().toLowerCase() === CONFIRMATION;

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({confirm: typed}),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => null))?.message ?? "Couldn't delete your account");
        return;
      }
      await signOut({redirectUrl: "/"});
    } catch (e) {
      reportClientError("Failed to delete account", e);
      setError("Couldn't delete your account");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm space-y-2">
        <p><Link href="/data" className="underline underline-offset-4">Export your applications, stages and stories first</Link></p>
        <p>This permanently deletes:</p>
        <ul className="list-disc pl-5 text-muted-foreground space-y-1">
          <li>every application, interview stage, debrief and note</li>
          <li>your saved stories and their interview links</li>
          <li>your companies and their history</li>
          <li>availability links you&apos;ve sent: anyone with one will get &quot;not found&quot;</li>
          <li>your calendar feed link</li>
          <li>your login</li>
        </ul>
        <p>It can&apos;t be undone.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="delete-confirm">Type &quot;{CONFIRMATION}&quot; to confirm</Label>
        <Input id="delete-confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button variant="destructive" className="cursor-pointer self-start" disabled={!confirmed || deleting} onClick={remove}>
        {deleting ? "Deleting…" : "Delete my account and data"}
      </Button>
    </div>
  );
}

// Guests' interviews never leave the browser, so that's the only place to clear
function ClearBrowser() {
  const [cleared, setCleared] = useState(false);
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>You&apos;re not signed in, so anything you&apos;ve added is only stored in this browser.</p>
      <Button
        variant="outline"
        className="cursor-pointer self-start"
        disabled={cleared}
        onClick={() => {
          clearGuestInterviews();
          window.dispatchEvent(new Event("guest:interviews:changed"));
          setCleared(true);
        }}
      >
        {cleared ? "Cleared" : "Clear this browser's data"}
      </Button>
    </div>
  );
}

export default function DeleteAccount() {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Delete your account</CardTitle>
        <CardDescription>Remove everything interviews.tools holds about you.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignedIn><DeleteForm /></SignedIn>
        <SignedOut><ClearBrowser /></SignedOut>
      </CardContent>
    </Card>
  );
}
