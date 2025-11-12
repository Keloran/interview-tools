"use client";

import {useAppStore} from "@/lib/store";
import {Card} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {cn, getStageColor, isSameDay} from "@/lib/utils";
import {useEffect, useMemo, useState} from "react";
import {CornerUpRight, X} from "lucide-react";
import {useQuery} from "@tanstack/react-query";
import {useUser} from "@clerk/nextjs";
import {SiGooglemeet, SiZoom} from "react-icons/si";
import {PiMicrosoftTeamsLogoFill} from "react-icons/pi";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import InterviewForm from "@/components/InterviewForm";
import {useRouter} from "next/navigation";
import {listGuestInterviews, removeGuestInterview} from "@/lib/guestStorage";
import Link from "next/link";
import InterviewInfo from "@/components/InterviewInfo";

function inferStageMethodName(locationType?: string | null, interviewLink?: string | null): string {
  if (locationType === "phone") return "Phone";
  if (!interviewLink) return "Link";
  const candidates: { re: RegExp; name: string }[] = [
    { re: /zoom\.us|zoom\.com/i, name: "Zoom" },
    { re: /zoomgov\.com/i, name: "ZoomGov" },
    { re: /teams\.microsoft\.com|microsoft\.teams|live\.com\/meet/i, name: "Teams" },
    { re: /meet\.google\.com|hangouts\.google\.com|google\.com\/hangouts|workspace\.google\.com\/products\/meet/i, name: "Google Meet" },
  ];
  const raw = String(interviewLink);
  let host: string;
  try { host = new URL(raw).hostname; } catch { try { host = new URL(`https://${raw}`).hostname; } catch { host = ""; } }
  const normalizedHost = host.replace(/^www\./i, "");
  const match = candidates.find((c) => c.re.test(normalizedHost) || c.re.test(raw));
  return match ? match.name : "Link";
}

interface InterviewApiItem {
  id: string | number;
  jobTitle: string;
  date?: string | Date | null;
  deadline?: string | Date | null;
  stage?: { stage: string } | null;
  stageMethod?: { method: string } | null;
  link?: string | null;
  company: { name: string; id: number };
  clientCompany?: string | null;
  jobPostingLink?: string | null;
  outcome?: string | null;
  metadata?: Record<string, unknown> | null;
}

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
  const router = useRouter()
  const filteredDateISO = useAppStore((s) => s.filteredDate);
  const setFilteredDate = useAppStore((s) => s.setFilteredDate);
  const setCompanyFilter = useAppStore((s) => s.setFilteredCompany)
  const dateFilter = useMemo(() => (filteredDateISO ? new Date(filteredDateISO + "T00:00:00") : null), [filteredDateISO]);
  const companyFilter = useAppStore((s) => s.filteredCompany);
  const [futureOnly, setFutureOnly] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [guestInterviews, setGuestInterviews] = useState<Interview[]>([]);

  // Load guest interviews and subscribe to changes when signed out
  useEffect(() => {
    if (!user) {
      const locals = listGuestInterviews();
      const mapped = locals.map((g) => ({
        id: g.id,
        title: g.jobTitle,
        date: g.date ? new Date(g.date) : new Date(),
        stage: g.stage,
        stageMethod: inferStageMethodName(g.locationType, g.interviewLink),
        link: g.interviewLink || "",
        company: { name: g.companyName, id: 0 },
        clientCompany: g.clientCompany,
        outcome: g.stage !== "Applied" ? "SCHEDULED" : "AWAITING_RESPONSE",
        jobPostingLink: g.jobPostingLink,
      }));
      setGuestInterviews(mapped);

      const onChanged = () => {
        const localsNow = listGuestInterviews();
        const mappedNow = localsNow.map((g) => ({
          id: g.id,
          title: g.jobTitle,
          date: g.date ? new Date(g.date) : new Date(),
          stage: g.stage,
          stageMethod: inferStageMethodName(g.locationType, g.interviewLink),
          link: g.interviewLink || "",
          company: { name: g.companyName, id: 0 },
          clientCompany: g.clientCompany,
          outcome: g.stage !== "Applied" ? "SCHEDULED" : "AWAITING_RESPONSE",
          jobPostingLink: g.jobPostingLink,
        }));
        setGuestInterviews(mappedNow);
      };
      const handleGuestChanged = () => onChanged();
      window.addEventListener("guest:interviews:changed", handleGuestChanged);
      return () => window.removeEventListener("guest:interviews:changed", handleGuestChanged);
    }
  }, [user]);

  const {data: interviewData} = useQuery({
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
  const interviews: Interview[] = (interviewData || []).map((item: InterviewApiItem) => ({
    id: String(item.id),
    title: item.jobTitle,
    date: new Date((item.date ?? item.deadline) as string),
    stage: item.stage?.stage || "Unknown",
    stageMethod: item.stageMethod?.method || "Unknown",
    link: item.link as string,
    company: {
      name: item.company.name,
      id: item.company.id,
    },
    clientCompany: item.clientCompany ?? undefined,
    outcome: (item.outcome as string) ?? "",
    jobPostingLink: (item.metadata as { jobListing?: string } | null | undefined)?.jobListing ?? undefined,
  }));

  const handleRejectInterview = async (interviewId: string | number) => {
    // If this is a guest interview, remove it locally
    if (typeof interviewId === "string" && interviewId.startsWith("guest_")) {
      removeGuestInterview(interviewId);
      setGuestInterviews((prev) => prev.filter((i) => i.id !== interviewId));
      return;
    }

    try {
      await fetch(`/api/interview/${interviewId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: "REJECTED",
        }),
      });
    } catch (error) {
      console.error("Failed to reject interview:", error);
    } finally {
      router.refresh()
    }
  };

  const handleProgressInterview = (interview: Interview) => {
    setSelectedInterview(interview);
    setProgressDialogOpen(true);
  };

  const baseList = user ? interviews : guestInterviews;
  const displayedInterviews = baseList.filter((interview) => {
    const matchDate = dateFilter ? isSameDay(interview.date, dateFilter) : true;
    const matchCompany = companyFilter ? interview.company.name === companyFilter : true;
    return matchDate && matchCompany;
  });

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
                        {interview.jobPostingLink && (
                          <Link href={interview.jobPostingLink}><Button variant={"outline"}>Job Posting</Button></Link>
                        )}&nbsp;
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary">
                          {interview.stage}
                        </span> &nbsp;
                        {getStageMethodButton(interview.stageMethod, interview.link)}
                      </div>
                    </div>
                  </div>
                  {(!user || String(interview.id).startsWith("guest_")) ? (
                    // Guest entries: allow local delete only
                    <Button variant={"ghost"} size={"sm"} className={"cursor-pointer"} onClick={() => handleRejectInterview(interview.id)}>
                      <X />
                    </Button>
                  ) : (
                    // Signed-in entries: full actions
                    <>
                      {/*<Button variant={"ghost"} size={"sm"} className={"cursor-pointer"}><Pencil /></Button>*/}
                      <Button variant={"ghost"} size={"sm"} className={"cursor-pointer"} onClick={() => handleProgressInterview(interview)}><CornerUpRight /></Button>
                      <Button variant={"ghost"} size={"sm"} className={"cursor-pointer"} onClick={() => handleRejectInterview(interview.id)}><X /></Button>
                    </>
                  )}
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

      <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
        <DialogContent>
          {selectedInterview && <InterviewInfo interviewId={selectedInterview.id} />}
        </DialogContent>
      </Dialog>

      <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Progress Interview - {selectedInterview?.title}</DialogTitle>
          </DialogHeader>
          {selectedInterview && (
            <InterviewForm
              interviewId={selectedInterview.id}
              onSuccess={() => {
                setProgressDialogOpen(false);
                setSelectedInterview(null);
                router.refresh();
              }}
              submitLabel="Schedule Next Stage"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
