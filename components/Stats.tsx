"use client";

import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

async function getInterviews() {
  const url = new URL('/api/interviews', window.location.origin);
  url.searchParams.set('includePast', 'true');

  const res = await fetch(url.toString(), {
    method: "GET",
  });

  if (!res.ok) {
    throw new Error("failed to get interviews");
  }

  return await res.json();
}

interface OutcomeStat {
  outcome: string;
  count: number;
  label: string;
  color: string;
}

const outcomeConfig: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: "Scheduled", color: "bg-blue-500" },
  AWAITING_RESPONSE: { label: "Awaiting Response", color: "bg-yellow-500" },
  PASSED: { label: "Passed", color: "bg-green-500" },
  REJECTED: { label: "Rejected", color: "bg-red-500" },
  OFFER_RECEIVED: { label: "Offer Received", color: "bg-purple-500" },
  OFFER_ACCEPTED: { label: "Offer Accepted", color: "bg-emerald-500" },
  OFFER_DECLINED: { label: "Offer Declined", color: "bg-gray-500" },
  WITHDREW: { label: "Withdrew", color: "bg-orange-500" },
};

export default function Stats() {
  const { user } = useUser();
  const filteredOutcome = useAppStore((s) => s.filteredOutcome);
  const setFilteredOutcome = useAppStore((s) => s.setFilteredOutcome);
  const setFilteredDate = useAppStore((s) => s.setFilteredDate);
  const setFilteredCompany = useAppStore((s) => s.setFilteredCompany);

  const { data: interviews } = useQuery({
    queryKey: ["interviews", user?.id],
    queryFn: getInterviews,
    enabled: !!user?.id,
  });

  if (!user || !interviews) {
    return null;
  }

  // Group interviews by outcome
  const outcomeCounts: Record<string, number> = {};
  interviews.forEach((interview: { outcome?: string }) => {
    const outcome = interview.outcome || "SCHEDULED";
    outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1;
  });

  // Convert to array of stats
  const stats: OutcomeStat[] = Object.entries(outcomeCounts)
    .map(([outcome, count]) => ({
      outcome,
      count,
      label: outcomeConfig[outcome]?.label || outcome,
      color: outcomeConfig[outcome]?.color || "bg-gray-500",
    }))
    .sort((a, b) => b.count - a.count);

  const handleStatClick = (outcome: string) => {
    // If already filtered by this outcome, clear the filter
    if (filteredOutcome === outcome) {
      setFilteredOutcome(null);
    } else {
      // Clear other filters and set outcome filter
      setFilteredDate(null);
      setFilteredCompany(null);
      setFilteredOutcome(outcome);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Interview Stats</h2>
      <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
        {stats.map((stat) => (
          <button
            key={stat.outcome}
            onClick={() => handleStatClick(stat.outcome)}
            className={cn(
              "flex flex-col items-center p-2 rounded-lg border transition-all hover:scale-105 cursor-pointer",
              filteredOutcome === stat.outcome
                ? "border-primary bg-accent"
                : "border-border hover:bg-accent"
            )}
          >
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center mb-2", stat.color)}>
              <span className="text-2xl font-bold text-white">{stat.count}</span>
            </div>
            <span className="text-sm text-center font-medium">{stat.label}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
