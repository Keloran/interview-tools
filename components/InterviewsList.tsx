"use client";

import { useAppStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, isSameDay } from "@/lib/utils";
import { useState } from "react";
import {CornerUpRight, Pencil, X} from "lucide-react";
import {useQuery} from "@tanstack/react-query";
import {useFlags} from "@flags-gg/react-library";
import {useUser} from "@clerk/nextjs";

interface Interview {
  id: string;
  title: string;
  date: Date;
  color: string;
  stage: string;
  company: {
    name: string;
    id: number
  };
}

async function getInterviews(date: Date | string | null) {
  const url = new URL('/api/interviews', window.location.origin);
  if (date) {
    const dateStr = date instanceof Date
      ? date.toISOString().split('T')[0]
      : date;
    url.searchParams.set('date', dateStr);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
  });

  if (!res.ok) {
    throw new Error("failed to get interviews");
  }

  return await res.json();
}


export default function InterviewsList() {
  const {user} = useUser()
  const {is} = useFlags()
  const filteredDateISO = useAppStore((s) => s.filteredDate);
  const setFilteredDate = useAppStore((s) => s.setFilteredDate);
  const dateFilter = filteredDateISO ? new Date(filteredDateISO + "T00:00:00") : null;
  const companyFilter = useAppStore((s) => s.filteredCompany);

  const {data: interviewData, error} = useQuery({
    queryKey: ["interviews", user?.id, filteredDateISO],
    queryFn: () => getInterviews(dateFilter),
    enabled: !!user?.id,
  })

  console.info("interviewsData", interviewData);

  const [currentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startingDayOfWeek = firstDayOfMonth.getDay();

  // Map API data to component interface
  const interviews: Interview[] = (interviewData || []).map((item: any) => ({
    id: item.id,
    title: item.jobTitle,
    date: new Date(item.date),
    color: "bg-blue-500", // You might want to add this to the API response
    stage: item.stage?.stage || "Unknown",
    link: item.link,
    company: {
      name: item.company.name,
      id: item.company.id,
    }
  }));

  const handleDeleteInterview = (interviewId: string) => {
    // TODO: Implement delete API call and invalidate query
    console.log("Delete interview", interviewId);
  };

  const displayedInterviews = dateFilter
    ? interviews.filter((interview) => isSameDay(interview.date, dateFilter))
    : interviews;

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="aspect-square" />);
  }

  // Placeholder: this would come from Prisma/DB filtered by filteredDate
  // For now just demonstrate the dependency on filteredDate
  return (
    <div className="flex-1">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold">
              {dateFilter
                ? "Events for " +
                dateFilter.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "All Upcoming Interviews"}
            </h2>
            {dateFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilteredDate(null)}
                className="mt-2 h-8"
              >
                <X className="h-3 w-3 mr-1" />
                Clear Date filter
              </Button>
            )}
          </div>
        </div>

        {displayedInterviews.length > 0 ? (
          <div className="space-y-3">
            {displayedInterviews
              .sort((a, b) => a.date.getTime() - b.date.getTime())
              .map((interview) => (
                <div
                  key={interview.id}
                  className="flex items-start justify-between p-4 rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full mt-1 flex-shrink-0",
                        interview.color,
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-lg">{interview.title} - {interview.company.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {interview.date.toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "numeric"
                        })}
                      </p>
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary">
                          {interview.stage}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button variant={"ghost"} size={"sm"} className={"cursor-pointer"}><Pencil /></Button>
                  <Button variant={"ghost"} size={"sm"} className={"cursor-pointer"}><CornerUpRight /></Button>
                  {/*<Button variant="ghost" size="sm" className={"cursor-pointer"} onClick={() => handleDeleteInterview(interview.id)}>*/}
                  {/*  <X />*/}
                  {/*</Button>*/}
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No Interviews scheduled</p>
            <p className="text-sm mt-1">
              Click the + button on a date to add an Interview
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
