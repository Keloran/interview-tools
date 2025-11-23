"use client"

import {useQuery} from "@tanstack/react-query";
import {useUser} from "@clerk/nextjs";
import {listGuestInterviews} from "@/lib/guestStorage";
import {useMemo} from "react";
import {deriveMethodFromLink, getStageMethodButton} from "@/lib/utils/interviewMethod";

export default function InterviewInfo(props: {interviewId: string | null}) {
  const {user} = useUser();
  const isGuest = typeof props.interviewId === 'string' && props.interviewId.startsWith('guest_');

  // Fetch interview data from API for authenticated users
  const { data: apiInterviewData } = useQuery({
    queryKey: ["interview", props.interviewId],
    queryFn: async () => {
      if (!props.interviewId) return null;
      const res = await fetch(`/api/interview/${props.interviewId}`);
      if (!res.ok) throw new Error("Failed to fetch interview");
      return await res.json();
    },
    enabled: !!props.interviewId && !!user && !isGuest,
  });

  // Get guest interview data from localStorage
  const guestInterviewData = useMemo(() => {
    if (!isGuest || !props.interviewId) return null;
    const guestInterviews = listGuestInterviews();
    return guestInterviews.find(i => i.id === props.interviewId);
  }, [isGuest, props.interviewId]);

  const interviewData = isGuest ? guestInterviewData : apiInterviewData;
  console.info("Interview info", interviewData);

  // Normalize guest/API data into a single view model for a unified layout
  interface GuestInterview {
    companyName?: string | null;
    clientCompany?: string | null;
    jobTitle?: string | null;
    stage?: string | null;
    status?: string | null;
    outcome?: string | null;
    date?: string | null;
    time?: string | null;
    interviewer?: string | null;
    locationType?: string | null;
    interviewLink?: string | null;
    jobPostingLink?: string | null;
    metadata?: { jobListing?: string } | null;
  }

  interface ApiInterview {
    company?: { name?: string | null } | null;
    clientCompany?: string | null;
    jobTitle?: string | null;
    stage?: { stage?: string | null } | null;
    status?: string | null;
    outcome?: string | null;
    date?: string | null;
    deadline?: string | null;
    interviewer?: string | null;
    stageMethod?: { method?: string | null } | null;
    link?: string | null;
    jobPostingLink?: string | null;
    metadata?: { jobListing?: string } | null;
  }

  interface ViewModel {
    company: string | null;
    clientCompany: string | null;
    jobTitle: string | null;
    stage: string | null;
    status: string | null;
    outcome: string | null;
    date: string | null;
    deadline: string | null;
    interviewer: string | null;
    method: string | null;
    link: string | null;
    jobPostingLink: string | null;
    notes: string | null;
    hasTime: boolean;
  }

  const vm = useMemo((): ViewModel | null => {
    if (!interviewData) return null;

    if (isGuest) {
      const d = interviewData as GuestInterview;
      const link: string | null = d.interviewLink ?? null;
      const method = d.locationType ?? deriveMethodFromLink(link);
      return {
        company: d.companyName ?? null,
        clientCompany: d.clientCompany ?? null,
        jobTitle: d.jobTitle ?? null,
        stage: d.stage ?? null,
        status: d.status ?? null,
        outcome: d.outcome ?? null,
        date: d.date ?? null,
        deadline: d.stage === "Technical Test" ? (d.date ?? null) : null,
        interviewer: d.interviewer ?? null,
        method: method ?? null,
        link,
        jobPostingLink: d.jobPostingLink ?? d.metadata?.jobListing ?? null,
        notes: (d as unknown as { notes?: string | null })?.notes ?? null,
        hasTime: Boolean(d.time),
      };
    }

    // API/DB data
    const d = interviewData as ApiInterview;
    return {
      company: d.company?.name ?? null,
      clientCompany: d.clientCompany ?? null,
      jobTitle: d.jobTitle ?? null,
      stage: d.stage?.stage ?? null,
      status: d.status ?? null,
      outcome: d.outcome ?? null,
      date: d.date ?? null,
      deadline: d.deadline ?? null,
      interviewer: d.interviewer ?? null,
      method: d.stageMethod?.method ?? null,
      link: d.link ?? null,
      jobPostingLink: d.jobPostingLink ?? d.metadata?.jobListing ?? null,
      notes: (d as unknown as { notes?: string | null })?.notes ?? null,
      hasTime: true,
    };
  }, [interviewData, isGuest]);

  if (!vm) {
    return <div className="text-center py-4 text-muted-foreground">Loading...</div>;
  }

  // getStageMethodButton is now imported from shared utils

  // Unified layout for both guest and authenticated interviews using the view model
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Company</p>
        <p className="text-base">{vm.company}</p>
      </div>

      {vm.clientCompany && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Client Company</p>
          <p className="text-base">{vm.clientCompany}</p>
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-muted-foreground">Job Title</p>
        <p className="text-base">{vm.jobTitle}</p>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground">Stage</p>
        <p className="text-base">{vm.stage}</p>
      </div>

      {vm.status && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Status</p>
          <p className="text-base">{vm.status}</p>
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-muted-foreground">Outcome</p>
        <p className="text-base">{vm.outcome || "Pending"}</p>
      </div>

      {(vm.date || vm.deadline) && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {vm.deadline ? "Deadline" : "Interview Date"}
          </p>
          <p className="text-base">
            {new Date((vm.date || vm.deadline) as string).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: vm.hasTime ? "numeric" : undefined,
              minute: vm.hasTime ? "numeric" : undefined,
            })}
          </p>
        </div>
      )}

      {vm.interviewer && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Interviewer</p>
          <p className="text-base">{vm.interviewer}</p>
        </div>
      )}

      {vm.method && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Interview Method</p>
          <p className="text-base">{vm.method}</p>
        </div>
      )}

      {vm.link && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Interview Link</p>
          {/* Show icon button if method recognized, otherwise show hyperlink */}
          {vm.method ? (
            getStageMethodButton(vm.method, vm.link)
          ) : (
            <a href={vm.link} target="_blank" rel="noopener noreferrer" className="text-base text-blue-600 hover:underline">
              {vm.link}
            </a>
          )}
        </div>
      )}

      {vm.jobPostingLink && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Job Posting</p>
          <a href={vm.jobPostingLink as string} target="_blank" rel="noopener noreferrer" className="text-base text-blue-600 hover:underline">
            View Job Posting
          </a>
        </div>
      )}

      {vm.notes && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Notes</p>
          <p className="text-base whitespace-pre-wrap">{vm.notes}</p>
        </div>
      )}
    </div>
  );
}