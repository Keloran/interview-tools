"use client"

import RecruiterContact from "@/components/RecruiterContact";
import type {RecruiterContact as Contact} from "@/lib/recruiters";
import FirstReplyDate from "@/components/FirstReplyDate";
import {useQuery} from "@tanstack/react-query";
import {useUser} from "@clerk/nextjs";
import {listGuestInterviews} from "@/lib/guestStorage";
import {useMemo, useState} from "react";
import {deriveMethodFromLink, getStageMethodButton} from "@/lib/utils/interviewMethod";
import {useAppStore} from "@/lib/store";
import {FEEDBACK_LABEL, FeedbackType} from "@/lib/feedback";
import {PreviousQuestions} from "@/components/QuestionBank";
import InterviewPrep from "@/components/InterviewPrep";
import Link from "next/link";

export default function InterviewInfo(props: {interviewId: string | null}) {
  const {user} = useUser();
  const [now] = useState(() => Date.now());
  const isGuest = typeof props.interviewId === 'string' && props.interviewId.startsWith('guest_');
  const setCompanyFilter = useAppStore((s) => s.setFilteredCompany);

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
    applicationId?: number;
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
    debriefedAt?: string | null;
    rating?: number | null;
    debriefNotes?: string | null;
    peopleMet?: string | null;
    questionsAsked?: string | null;
    nextStep?: string | null;
    replyBy?: string | null;
    prepNotes?: string | null;
    feedbackType?: FeedbackType | null;
    feedbackText?: string | null;
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

  const handleCompanyClick = () => {
    if (vm?.company) {
      setCompanyFilter(vm.company);
    }
  };

  // Unified layout for both guest and authenticated interviews using the view model
  const applicationContact = interviewData as Contact & {applicationId?: number; applicationDate?: string; firstResponseAt?: string | null};
  return (
    <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
      {!isGuest && (interviewData as ApiInterview)?.applicationId && <Link className="inline-block underline underline-offset-2" href={`/applications/${(interviewData as ApiInterview).applicationId}`}>View application timeline</Link>}
      <div>
        <p className="text-sm font-medium text-muted-foreground">Company</p>
        <p
          className="text-base text-blue-600 hover:underline cursor-pointer"
          onClick={handleCompanyClick}
        >
          {vm.company}
        </p>
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

      {!isGuest && vm.outcome === "SCHEDULED" && vm.date && Date.parse(vm.date) > now && vm.stage && (vm.clientCompany || vm.company) && (
        <PreviousQuestions interviewId={Number(props.interviewId)} company={(vm.clientCompany || vm.company)!} stage={vm.stage} date={vm.date} />
      )}
      {!isGuest && props.interviewId && <InterviewPrep interviewId={props.interviewId} />}
      {!isGuest && applicationContact.applicationId && <RecruiterContact key={applicationContact.applicationId} applicationId={applicationContact.applicationId} agency={vm.company ?? ""} clientCompany={vm.clientCompany} contact={applicationContact} />}
      {!isGuest && applicationContact.applicationId && applicationContact.applicationDate && <FirstReplyDate applicationId={applicationContact.applicationId} applied={applicationContact.applicationDate} value={applicationContact.firstResponseAt} />}
      {!isGuest && (interviewData as ApiInterview)?.debriefedAt && <Debrief d={interviewData as ApiInterview} />}

      {!isGuest && (interviewData as ApiInterview)?.feedbackType && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Feedback</p>
          <p className="text-base whitespace-pre-wrap">
            {FEEDBACK_LABEL[(interviewData as ApiInterview).feedbackType!]}
            {(interviewData as ApiInterview).feedbackText && `: ${(interviewData as ApiInterview).feedbackText}`}
          </p>
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
const RATING_LABEL = ["", "Badly", "Not great", "OK", "Well", "Great"];

function Debrief({d}: { d: { rating?: number | null; debriefNotes?: string | null; peopleMet?: string | null; questionsAsked?: string | null; nextStep?: string | null; replyBy?: string | null; prepNotes?: string | null } }) {
  const rows: [string, string | null | undefined][] = [
    ["How it went", d.rating ? RATING_LABEL[d.rating] : null],
    ["Debrief", d.debriefNotes],
    ["Who you met", d.peopleMet],
    ["Questions they asked", d.questionsAsked],
    ["What happens next", [d.nextStep, d.replyBy && `hear back by ${new Date(d.replyBy).toLocaleDateString(undefined, {day: "numeric", month: "long"})}`].filter(Boolean).join(", ")],
  ];
  return (
    <>
      {rows.filter(([, v]) => v).map(([label, value]) => (
        <div key={label}>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-base whitespace-pre-wrap">{value}</p>
        </div>
      ))}
    </>
  );
}
