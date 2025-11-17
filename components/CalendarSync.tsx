"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {useFlags} from "@flags-gg/react-library";
import {useUser} from "@clerk/nextjs";

interface CalendarSettings {
  calendarUuid: string;
  calendarUrl: string;
}

async function getCalendarSettings(): Promise<CalendarSettings> {
  const res = await fetch("/api/calendar-settings");
  if (!res.ok) {
    throw new Error("Failed to fetch calendar settings");
  }
  return res.json();
}

async function regenerateCalendarUuid(): Promise<CalendarSettings> {
  const res = await fetch("/api/calendar-settings", {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Failed to regenerate calendar UUID");
  }
  return res.json();
}

export default function CalendarSync() {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const {is} = useFlags()
  const {user} = useUser()

  const { data, isLoading } = useQuery({
    queryKey: ["calendar-settings"],
    queryFn: getCalendarSettings,
  });

  const regenerateMutation = useMutation({
    mutationFn: regenerateCalendarUuid,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-settings"] });
      setShowConfirm(false);
    },
  });

  const handleCopy = async () => {
    if (data?.calendarUrl) {
      await navigator.clipboard.writeText(data.calendarUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerate = () => {
    regenerateMutation.mutate();
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading calendar settings...</div>;
  }

  if (is("calendar sync").disabled()) {
    return null
  }

  if (user == null) {
    return null;
  }

  return (
    <div className="p-4">
      <div>
        <p className="text-sm text-muted-foreground mb-4">
          Subscribe to your interview calendar in any calendar app (Google Calendar, Apple Calendar, Outlook, etc.)
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="calendar-url">Calendar Subscription URL</Label>
        <div className="flex gap-2">
          <Input
            id="calendar-url"
            value={data?.calendarUrl || ""}
            readOnly
            className="font-mono text-xs"
          />
          <Button onClick={handleCopy} variant="outline" className="shrink-0">
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">How to use:</p>
        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Copy the URL above</li>
          <li>Open your calendar app</li>
          <li>Look for &quot;Add calendar from URL&quot; or &quot;Subscribe to calendar&quot;</li>
          <li>Paste the URL and save</li>
          <li>Your interviews will sync automatically</li>
        </ol>
      </div>

      <div className="pt-4 border-t">
        {!showConfirm ? (
          <Button
            onClick={() => setShowConfirm(true)}
            variant="outline"
            className="text-destructive"
            size="sm"
          >
            Regenerate URL
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-destructive">
              This will invalidate your current calendar subscription. You&apos;ll need to re-add the new URL to your calendar app.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleRegenerate}
                variant="destructive"
                size="sm"
                disabled={regenerateMutation.isPending}
              >
                {regenerateMutation.isPending ? "Regenerating..." : "Confirm Regenerate"}
              </Button>
              <Button
                onClick={() => setShowConfirm(false)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}