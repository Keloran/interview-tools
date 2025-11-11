"use client";

import { useAppStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {cn, getStageColor, isSameDay} from "@/lib/utils";
import { useState, useEffect } from "react";
import {CornerUpRight, Pencil, X} from "lucide-react";
import {useQuery} from "@tanstack/react-query";
import {useFlags} from "@flags-gg/react-library";
import {useUser} from "@clerk/nextjs";
import {SiGooglemeet, SiZoom} from "react-icons/si";
import {PiMicrosoftTeamsLogoFill} from "react-icons/pi";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import InterviewForm, { InterviewFormValues } from "@/components/InterviewForm";
import {useRouter} from "next/navigation";

interface Interview {
  id: string;
  title: string;
  date: Date;
  stage: string;
  stageMethod: string;
  outcome: string;
  link: string;
  company: {
    name: string;
    id: number
  };
  clientCompany?: string;
  jobPostingLink?: string;
}

async function getInterviews(date: Date | string | null, company?: string | null, futureOnly?: boolean) {
  const url = new URL('/api/interviews', window.location.origin);
  if (date) {
    const dateStr = date instanceof Date
      ? date.toISOString().split('T')[0]
      : date;
    url.searchParams.set('date', dateStr);
  }
  if (company) {
    url.searchParams.set('company', company);
  }
  // Only send includePast when we have a company filter without a date filter
  // This allows the backend to use smart defaults otherwise
  if (company && !date) {
    url.searchParams.set('includePast', (!futureOnly).toString());
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
  const router = useRouter()
  const filteredDateISO = useAppStore((s) => s.filteredDate);
  const setFilteredDate = useAppStore((s) => s.setFilteredDate);
  const setCompanyFilter = useAppStore((s) => s.setFilteredCompany)
  const dateFilter = filteredDateISO ? new Date(filteredDateISO + "T00:00:00") : null;
  const companyFilter = useAppStore((s) => s.filteredCompany);
  const [futureOnly, setFutureOnly] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);

  const {data: interviewData, error} = useQuery({
    queryKey: ["interviews", user?.id, filteredDateISO, companyFilter, futureOnly],
    queryFn: () => getInterviews(dateFilter, companyFilter, futureOnly),
    enabled: !!user?.id,
  })

  const [currentDate] = useState(new Date());

  // Reset futureOnly when company filter is cleared or date filter is applied
  useEffect(() => {
    if (!companyFilter || dateFilter) {
      setFutureOnly(false);
    }
  }, [companyFilter, dateFilter]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  // Adjust for Monday start (0 = Monday, 6 = Sunday)
  const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

  // console.info("InterviewData", interviewData);

  // Map API data to component interface
  const interviews: Interview[] = (interviewData || []).map((item: any) => ({
    id: item.id,
    title: item.jobTitle,
    date: new Date(item.date),
    stage: item.stage?.stage || "Unknown",
    stageMethod: item.stageMethod?.method || "Unknown",
    link: item.link,
    company: {
      name: item.company.name,
      id: item.company.id,
    },
    clientCompany: item.clientCompany,
    outcome: item.outcome,
    jobPostingLink: item.metadata?.jobListing,
  }));

  const handleDeleteInterview = (interviewId: string) => {
    // TODO: Implement delete API call and invalidate query
    console.log("Delete interview", interviewId);
  };

  const handleProgressInterview = (interview: Interview) => {
    setSelectedInterview(interview);
    setProgressDialogOpen(true);
  };

  const handleProgressSubmit = async (values: InterviewFormValues) => {
    try {
      // Combine date and time into ISO string
      const dateTimeStr = values.date && values.time
        ? `${values.date}T${values.time}`
        : new Date().toISOString();

      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: values.stage,
          companyName: values.companyName,
          clientCompany: values.clientCompany,
          jobTitle: values.jobTitle,
          jobPostingLink: values.jobPostingLink,
          date: dateTimeStr,
          interviewer: values.interviewer,
          locationType: values.locationType,
          interviewLink: values.interviewLink,
        }),
      });

      if (res.ok) {
        // Refresh the page to get updated data
        router.refresh();
        setProgressDialogOpen(false);
        setSelectedInterview(null);
      }
    } catch (error) {
      console.error("Failed to create interview:", error);
    }
  };

  const displayedInterviews = dateFilter
    ? interviews.filter((interview) => isSameDay(interview.date, dateFilter))
    : interviews;

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="aspect-square" />);
  }

  const getStageMethodButton = (stageMethod: string, link: string) => {
    switch (stageMethod) {
      case "Zoom": {
        return (
          <Button variant={"outline"} className={"cursor-pointer"} onClick={() => window.open(link)}>
            <SiZoom/>
          </Button>
        )
      }
      case "Teams": {
        return (
          <Button variant={"outline"} className={"cursor-pointer"} onClick={() => window.open(link)}>
            <PiMicrosoftTeamsLogoFill />
          </Button>
        )
      }
      case "Google Meet": {
        return (
          <Button variant={"outline"} className={"cursor-pointer"} onClick={() => window.open(link)}>
            <SiGooglemeet />
          </Button>
        )
      }
    }
  }

  const formatOutcome = (outcome: string): string => {
    return outcome
      .split('_') // split at underscores
      .map(
        word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() // capitalize each word
      )
      .join(' ');
  };

  // Placeholder: this would come from Prisma/DB filtered by filteredDate
  // For now just demonstrate the dependency on filteredDate
  return (
    <div className="flex-1">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold">
              {companyFilter && dateFilter
                ? `${companyFilter} Interviews for ${dateFilter.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}`
                : companyFilter
                ? `All Interviews with ${companyFilter}`
                : dateFilter
                ? "Interviews for " +
                  dateFilter.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "All Upcoming Interviews"}
            </h2>
            {dateFilter && (
              <Button variant="ghost" size="sm" onClick={() => setFilteredDate(null)} className="mt-2 h-8 cursor-pointer">
                <X className="h-3 w-3 mr-1" />
                Clear Date filter
              </Button>
            )}
            {companyFilter && (
              <>
                <Button variant="ghost" onClick={() => setCompanyFilter(null)} className="mt-2 h-8 cursor-pointer">
                  <X className="h-3 w-3 mr-1" />
                  Clear Company filter
                </Button>
                {!dateFilter && (
                  <Button
                    variant={futureOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFutureOnly(!futureOnly)}
                    className="mt-2 h-8 cursor-pointer ml-2"
                  >
                    {futureOnly ? "Showing Future Only" : "Show Future Only"}
                  </Button>
                )}
              </>
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={cn("w-3 h-3 rounded-full mt-1 flex-shrink-0", getStageColor(interview.outcome),)} />
                      </TooltipTrigger>
                      <TooltipContent>
                        {formatOutcome(interview.outcome ?? "not happened yet")}
                      </TooltipContent>
                    </Tooltip>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-lg">
                        {interview.title} - {interview.company.name}
                        {interview.clientCompany && <span className="text-muted-foreground font-normal"> (for {interview.clientCompany})</span>}
                      </p>
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
                        {getStageMethodButton(interview.stageMethod, interview.link)}
                      </div>
                    </div>
                  </div>
                  <Button variant={"ghost"} size={"sm"} className={"cursor-pointer"}><Pencil /></Button>
                  <Button variant={"ghost"} size={"sm"} className={"cursor-pointer"} onClick={() => handleProgressInterview(interview)}><CornerUpRight /></Button>
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

      <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Progress Interview - {selectedInterview?.title}</DialogTitle>
          </DialogHeader>
          {selectedInterview && (
            <InterviewForm
              initialValues={{
                companyName: selectedInterview.company.name,
                clientCompany: selectedInterview.clientCompany,
                jobTitle: selectedInterview.title,
                jobPostingLink: selectedInterview.jobPostingLink,
                stage: selectedInterview.stage,
              }}
              onSubmit={handleProgressSubmit}
              submitLabel="Schedule Next Stage"
              isProgressing={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
