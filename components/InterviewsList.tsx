"use client";

import {useAppStore} from "@/lib/store";
import {Card} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {cn, getStageColor, isSameDay, toISODate} from "@/lib/utils";
import {useEffect, useMemo, useState} from "react";
import {CalendarClock, Check, Clock, CornerUpRight, MessageSquare, MessageSquareQuote, NotebookPen, Pencil, ThumbsDown, X} from "lucide-react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {useUser} from "@clerk/nextjs";
import { getStageMethodButton } from "@/lib/utils/interviewMethod";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import InterviewForm from "@/components/InterviewForm";
import {useRouter} from "next/navigation";
import {listGuestInterviews, removeGuestInterview} from "@/lib/guestStorage";
import Link from "next/link";
import InterviewInfo from "@/components/InterviewInfo";
import InterviewEditForm from "@/components/InterviewEditForm";
import ShareAvailability from "@/components/ShareAvailability";
import FreeTimes from "@/components/FreeTimes";
import SendMessage from "@/components/SendMessage";
import {templatesFor} from "@/lib/messages";
import DebriefForm from "@/components/DebriefForm";
import FeedbackForm from "@/components/FeedbackForm";
import {needsDebrief} from "@/lib/debrief";
import {useFlags} from "@flags-gg/react-library";
import {reportClientError} from "@/lib/reportClientError";
import {addDays} from "@/lib/busy";
import {isOpenOffer, offerDeadlineState} from "@/lib/offers";
import {parseLocalDay} from "@/lib/searchReport";

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
  applicationId?: number;
  applicationDate?: string | Date | null;
  jobTitle: string;
  date?: string | Date | null;
  deadline?: string | Date | null;
  stage?: { stage: string } | null;
  stageMethod?: { method: string } | null;
  link?: string | null;
  interviewer?: string | null;
  debriefedAt?: string | null;
  company: { name: string; id: number };
  clientCompany?: string | null;
  jobPostingLink?: string | null;
  outcome?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface Interview {
  id: string;
  offer?: boolean;
  offerOpen?: boolean;
  respondBy?: string | null;
  applicationId?: number;
  title: string;
  date: Date;
  stage: string;
  stageMethod: string;
  outcome: string;
  link: string;
  interviewer?: string;
  debriefedAt?: string;
  company: {
    name: string;
    id: number
  };
  clientCompany?: string;
  jobPostingLink?: string;
}

async function getInterviews(date: Date | string | null, company?: string | null, futureOnly?: boolean, outcome?: string | null) {
  const url = new URL('/api/interviews', window.location.origin);

  // When filtering by outcome, show all interviews (ignore date filters)
  if (outcome) {
    url.searchParams.set('latestOnly', 'true');
    url.searchParams.set('take', '2000');
    url.searchParams.set('includePast', 'true');
    url.searchParams.set('outcome', outcome);
  } else {
    // Normal date/company filtering
    if (date) {
      // The API filters by UTC day, but the day picked is local: ask for a day either side
      // and let the isSameDay filter below narrow it to the local day
      const day = date instanceof Date ? toISODate(date) : date;
      url.searchParams.set('dateFrom', addDays(day, -1));
      url.searchParams.set('dateTo', addDays(day, 1));
    }
    // Only send includePast when we have a company filter without a date filter
    // This allows the backend to use smart defaults otherwise
    if (company && !date) {
      url.searchParams.set('includePast', (!futureOnly).toString());
    }
  }

  if (company) {
    url.searchParams.set('company', company);
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
  const queryClient = useQueryClient()
  const filteredDateISO = useAppStore((s) => s.filteredDate);
  const setFilteredDate = useAppStore((s) => s.setFilteredDate);
  const setCompanyFilter = useAppStore((s) => s.setFilteredCompany)
  const dateFilter = useMemo(() => (filteredDateISO ? new Date(filteredDateISO + "T00:00:00") : null), [filteredDateISO]);
  const companyFilter = useAppStore((s) => s.filteredCompany);
  const outcomeFilter = useAppStore((s) => s.filteredOutcome);
  const setOutcomeFilter = useAppStore((s) => s.setFilteredOutcome);
  const [futureOnly, setFutureOnly] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [outcomeError, setOutcomeError] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [debriefDialogOpen, setDebriefDialogOpen] = useState(false);
  // "reject" asks for feedback while marking it rejected; "edit" changes feedback already noted
  const [feedbackDialog, setFeedbackDialog] = useState<"reject" | "edit" | null>(null);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [guestInterviews, setGuestInterviews] = useState<Interview[]>([]);
  const {is} = useFlags()

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
    queryKey: ["interviews", user?.id, filteredDateISO, companyFilter, futureOnly, outcomeFilter],
    queryFn: () => getInterviews(dateFilter, companyFilter, futureOnly, outcomeFilter),
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
    applicationId: item.applicationId,
    offer: item.stage?.stage.trim().toLowerCase() === "offer",
    offerOpen: isOpenOffer(item.stage?.stage, item.outcome),
    respondBy: item.stage?.stage.trim().toLowerCase() === "offer" && item.deadline ? new Date(item.deadline).toISOString().slice(0, 10) : null,
    title: item.jobTitle,
    date: item.stage?.stage.trim().toLowerCase() === "offer" && item.deadline ? parseLocalDay(new Date(item.deadline).toISOString().slice(0, 10))! : new Date(item.date ?? item.deadline ?? item.applicationDate ?? ""),
    stage: item.stage?.stage || "Unknown",
    stageMethod: item.stageMethod?.method || "Unknown",
    link: item.link as string,
    interviewer: item.interviewer ?? undefined,
    debriefedAt: item.debriefedAt ?? undefined,
    company: {
      name: item.company.name,
      id: item.company.id,
    },
    clientCompany: item.clientCompany ?? undefined,
    outcome: (item.outcome as string) ?? "",
    jobPostingLink: (item.metadata as { jobListing?: string } | null | undefined)?.jobListing ?? undefined,
  }));

  const handleRejectInterview = async (interview: Interview) => {
    // If this is a guest interview, remove it locally
    if (interview.id.startsWith("guest_")) {
      removeGuestInterview(interview.id);
      setGuestInterviews((prev) => prev.filter((i) => i.id !== interview.id));
      return;
    }

    try {
      await fetch(`/api/interview/${interview.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: "REJECTED",
        }),
      });
      interview.outcome = "REJECTED";
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
    } catch (error) {
      reportClientError("Failed to reject interview", error);
    } finally {
      router.refresh()
    }
  };

  const handleProgressInterview = (interview: Interview) => {
    setSelectedInterview(interview);
    setProgressDialogOpen(true);
  };

  const handleEditInterview = (interview: Interview) => {
    setSelectedInterview(interview);
    setEditDialogOpen(true);
  };

  const handleSetOutcome = async (interview: Interview, outcome: string) => {
    setOutcomeError("");
    if (interview.id.startsWith("guest_")) {
      interview.outcome = outcome;
      return
    }

    try {
      const response = await fetch(`/api/interview/${interview.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome })
      })
      if (!response.ok) throw new Error("Outcome update failed");
      interview.outcome = outcome;
      // Invalidate queries to refetch data
      await Promise.all(["interviews", "companies", "stale-applications", "search-report", "activity-log", "follow-ups", "application-timeline"].map((key) => queryClient.invalidateQueries({queryKey: [key]})));
    } catch (error) {
      setOutcomeError("Could not update this application. Please try again.");
      reportClientError(`Failed to set ${outcome} on interview`, error);
    } finally {
      router.refresh()
    }
  }

  const baseList = user ? interviews : guestInterviews;
  const displayedInterviews = baseList.filter((interview) => {
    // When outcome filter is active, API already filtered by outcome, so only apply client-side filters for date/company when not filtering by outcome
    if (outcomeFilter) {
      // API already filtered by outcome, no additional filtering needed
      return true;
    }
    const matchDate = dateFilter ? isSameDay(interview.date, dateFilter) : true;
    const matchCompany = companyFilter ? interview.company.name === companyFilter : true;
    return matchDate && matchCompany;
  });

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="aspect-square" />);
  }

  // getStageMethodButton is now imported from shared utilities

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
        {outcomeError && <p role="alert" className="text-destructive">{outcomeError}</p>}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold">
              {outcomeFilter
                ? `${displayedInterviews.length > 0 ? `${displayedInterviews.length} ` : ""}${formatOutcome(outcomeFilter)} Interview${displayedInterviews.length !== 1 ? "s" : ""}`
                : companyFilter && dateFilter
                ? `${displayedInterviews.length > 0 ? `${displayedInterviews.length} ` : ""}${companyFilter} Interview${displayedInterviews.length !== 1 ? "s" : ""} for ${dateFilter.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}`
                : companyFilter
                ? `All ${displayedInterviews.length > 0 ? `${displayedInterviews.length} ` : ""}Interview${displayedInterviews.length !== 1 ? "s" : ""} with ${companyFilter}`
                : dateFilter
                ? `${displayedInterviews.length > 0 ? `${displayedInterviews.length} ` : ""}Interview${displayedInterviews.length !== 1 ? "s" : ""} for ${dateFilter.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}`
                : `All ${displayedInterviews.length > 0 ? `${displayedInterviews.length} ` : ""}Upcoming Interview${displayedInterviews.length !== 1 ? "s" : ""}`}
            </h2>
            {user && filteredDateISO && <FreeTimes day={filteredDateISO} />}
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
            {outcomeFilter && (
              <Button variant="ghost" onClick={() => setOutcomeFilter(null)} className="mt-2 h-8 cursor-pointer">
                <X className="h-3 w-3 mr-1" />
                Clear Outcome filter
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
                  className="flex items-start justify-between p-4 rounded-lg border border-border hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedInterview(interview)
                    setInfoDialogOpen(true)
                  }}
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
                        {interview.offer ? interview.respondBy ? `Respond by ${interview.respondBy}${interview.offerOpen ? ` · ${offerDeadlineState(interview.respondBy).label}` : ""}` : "No respond-by date recorded" : interview.date.toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "numeric"
                        })}
                      </p>
                      <div className="mt-2">
                        {interview.applicationId && <Link className="mr-3 text-sm underline underline-offset-2" href={`/applications/${interview.applicationId}`} onClick={(event) => event.stopPropagation()}>Timeline</Link>}
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
                    <Button
                      variant={"ghost"}
                      size={"sm"}
                      className={"cursor-pointer"}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRejectInterview(interview);
                      }}
                    >
                      <X />
                    </Button>
                  ) : (
                    // Signed-in entries: full actions
                    <>
                      {is("edit interview").enabled() && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={"ghost"}
                              size={"sm"}
                              className={"cursor-pointer"}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditInterview(interview);
                              }}
                            >
                              <Pencil />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit Interview Details</TooltipContent>
                        </Tooltip>
                      )}
                      {interview.stage !== "Applied" && interview.date.getTime() < Date.now() && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={"ghost"}
                              size={"sm"}
                              // stands out until it's been done
                              className={cn("cursor-pointer", needsDebrief(interview) && "text-primary")}
                              aria-label={interview.debriefedAt ? "Edit debrief" : "Debrief"}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedInterview(interview);
                                setDebriefDialogOpen(true);
                              }}
                            >
                              <NotebookPen />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{interview.debriefedAt ? "Edit debrief" : "Debrief: how did it go?"}</TooltipContent>
                        </Tooltip>
                      )}
                      {interview.outcome.toUpperCase() === "REJECTED" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={"ghost"}
                              size={"sm"}
                              className={"cursor-pointer"}
                              aria-label="Feedback"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedInterview(interview);
                                setFeedbackDialog("edit");
                              }}
                            >
                              <MessageSquareQuote />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Feedback they gave</TooltipContent>
                        </Tooltip>
                      )}
                      {templatesFor(interview).length > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={"ghost"}
                              size={"sm"}
                              className={"cursor-pointer"}
                              aria-label="Send a message"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedInterview(interview);
                                setMessageDialogOpen(true);
                              }}
                            >
                              <MessageSquare />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Send a message</TooltipContent>
                        </Tooltip>
                      )}
                      {interview.stage !== "Offer" && !["REJECTED", "WITHDREW", "OFFER_ACCEPTED", "OFFER_DECLINED", "NO_RESPONSE"].includes(interview.outcome.toUpperCase()) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={"ghost"}
                              size={"sm"}
                              className={"cursor-pointer"}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedInterview(interview);
                                setAvailabilityDialogOpen(true);
                              }}
                            >
                              <CalendarClock />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Share your availability for the next stage</TooltipContent>
                        </Tooltip>
                      )}
                      {interview.outcome === "NO_RESPONSE" && <Button size="sm" variant="outline" onClick={(event) => {event.stopPropagation(); handleSetOutcome(interview, "AWAITING_RESPONSE");}}>Reopen application</Button>}
                      {!["REJECTED", "PASSED", "OFFER_ACCEPTED", "OFFER_DECLINED", "NO_RESPONSE"].includes(interview.outcome.toUpperCase()) && (
                        <>
                          {interview.stage === "Offer" ? (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={"ghost"}
                                    size={"sm"}
                                    className={"cursor-pointer"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSetOutcome(interview, "OFFER_ACCEPTED");
                                    }}
                                  >
                                    <Check />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Accept offer</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={"ghost"}
                                    size={"sm"}
                                    className={"cursor-pointer"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSetOutcome(interview, "OFFER_DECLINED");
                                    }}
                                  >
                                    <ThumbsDown />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Decline offer</TooltipContent>
                              </Tooltip>
                            </>
                          ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={"ghost"}
                                size={"sm"}
                                className={"cursor-pointer"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleProgressInterview(interview);
                                }}
                              >
                                <CornerUpRight />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Progress interview to next stage</TooltipContent>
                          </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={"ghost"}
                                size={"sm"}
                                className={"cursor-pointer"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedInterview(interview);
                                  setFeedbackDialog("reject");
                                }}
                              >
                                <X />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Rejected
                            </TooltipContent>
                          </Tooltip>

                          {interview.outcome.toLowerCase() !== "awaiting_response" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={"ghost"}
                                  size={"sm"}
                                  className={"cursor-pointer"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetOutcome(interview, "AWAITING_RESPONSE");
                                  }}
                                >
                                  <Clock />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Set to awaiting response</TooltipContent>
                            </Tooltip>
                          )}
                        </>
                      )}
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
          <DialogHeader>
            <DialogTitle>{selectedInterview?.title}</DialogTitle>
          </DialogHeader>
          {selectedInterview && (
            <InterviewInfo
              interviewId={selectedInterview.id} />
          )}
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

      <Dialog
        open={availabilityDialogOpen}
        onOpenChange={(open) => {
          setAvailabilityDialogOpen(open);
          if (!open) router.refresh();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share availability - {selectedInterview?.title}</DialogTitle>
          </DialogHeader>
          {selectedInterview && <ShareAvailability key={selectedInterview.id} interviewId={selectedInterview.id} currentStage={selectedInterview.stage} />}
        </DialogContent>
      </Dialog>

      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a message - {selectedInterview?.title}</DialogTitle>
          </DialogHeader>
          {selectedInterview && (
            <SendMessage
              key={selectedInterview.id}
              templates={templatesFor(selectedInterview)}
              context={{
                jobTitle: selectedInterview.title,
                company: selectedInterview.company.name,
                clientCompany: selectedInterview.clientCompany,
                stage: selectedInterview.stage,
                interviewer: selectedInterview.interviewer,
                date: selectedInterview.date,
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={debriefDialogOpen} onOpenChange={setDebriefDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Debrief - {selectedInterview?.title}</DialogTitle>
          </DialogHeader>
          {selectedInterview && (
            <DebriefForm key={selectedInterview.id} interviewId={selectedInterview.id} onSuccess={() => setDebriefDialogOpen(false)} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!feedbackDialog} onOpenChange={(open) => !open && setFeedbackDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{feedbackDialog === "reject" ? "Rejected" : "Feedback"} - {selectedInterview?.title}</DialogTitle>
          </DialogHeader>
          {selectedInterview && feedbackDialog && (
            <FeedbackForm
              key={selectedInterview.id}
              interviewId={selectedInterview.id}
              reject={feedbackDialog === "reject"}
              onSuccess={() => {
                setFeedbackDialog(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Interview - {selectedInterview?.title}</DialogTitle>
          </DialogHeader>
          {selectedInterview && (
            <InterviewEditForm
              interviewId={selectedInterview.id}
              onSuccess={() => {
                setEditDialogOpen(false);
                setSelectedInterview(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
