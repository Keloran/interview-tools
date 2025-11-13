"use client"

import {useQuery} from "@tanstack/react-query";
import {useUser} from "@clerk/nextjs";
import {listGuestInterviews} from "@/lib/guestStorage";
import {useMemo} from "react";

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

  if (!interviewData) {
    return <div className="text-center py-4 text-muted-foreground">Loading...</div>;
  }

  // For guest interviews
  if (isGuest) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Company</p>
          <p className="text-base">{interviewData.companyName}</p>
        </div>

        {interviewData.clientCompany && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Client Company</p>
            <p className="text-base">{interviewData.clientCompany}</p>
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-muted-foreground">Job Title</p>
          <p className="text-base">{interviewData.jobTitle}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-muted-foreground">Stage</p>
          <p className="text-base">{interviewData.stage}</p>
        </div>

        {interviewData.date && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {interviewData.stage === "Technical Test" ? "Deadline" : "Interview Date"}
            </p>
            <p className="text-base">
              {new Date(interviewData.date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: interviewData.time ? "numeric" : undefined,
                minute: interviewData.time ? "numeric" : undefined,
              })}
            </p>
          </div>
        )}

        {interviewData.interviewer && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Interviewer</p>
            <p className="text-base">{interviewData.interviewer}</p>
          </div>
        )}

        {interviewData.locationType && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Interview Type</p>
            <p className="text-base capitalize">{interviewData.locationType}</p>
          </div>
        )}

        {interviewData.interviewLink && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Interview Link</p>
            <a href={interviewData.interviewLink} target="_blank" rel="noopener noreferrer" className="text-base text-blue-600 hover:underline">
              {interviewData.interviewLink}
            </a>
          </div>
        )}

        {interviewData.jobPostingLink && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Job Posting</p>
            <a href={interviewData.jobPostingLink} target="_blank" rel="noopener noreferrer" className="text-base text-blue-600 hover:underline">
              View Job Posting
            </a>
          </div>
        )}

        {interviewData.notes && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Notes</p>
            <p className="text-base whitespace-pre-wrap">{interviewData.notes}</p>
          </div>
        )}
      </div>
    );
  }

  // For authenticated users - display API data
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Company</p>
        <p className="text-base">{interviewData.company?.name}</p>
      </div>

      {interviewData.clientCompany && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Client Company</p>
          <p className="text-base">{interviewData.clientCompany}</p>
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-muted-foreground">Job Title</p>
        <p className="text-base">{interviewData.jobTitle}</p>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground">Stage</p>
        <p className="text-base">{interviewData.stage?.stage}</p>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground">Status</p>
        <p className="text-base">{interviewData.status}</p>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground">Outcome</p>
        <p className="text-base">{interviewData.outcome || "Pending"}</p>
      </div>

      {(interviewData.date || interviewData.deadline) && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {interviewData.deadline ? "Deadline" : "Interview Date"}
          </p>
          <p className="text-base">
            {new Date(interviewData.date || interviewData.deadline).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "numeric",
            })}
          </p>
        </div>
      )}

      {interviewData.interviewer && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Interviewer</p>
          <p className="text-base">{interviewData.interviewer}</p>
        </div>
      )}

      {interviewData.stageMethod && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Interview Method</p>
          <p className="text-base">{interviewData.stageMethod.method}</p>
        </div>
      )}

      {interviewData.link && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Interview Link</p>
          <a href={interviewData.link} target="_blank" rel="noopener noreferrer" className="text-base text-blue-600 hover:underline">
            {interviewData.link}
          </a>
        </div>
      )}

      {interviewData.metadata?.jobListing && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Job Posting</p>
          <a href={interviewData.metadata.jobListing as string} target="_blank" rel="noopener noreferrer" className="text-base text-blue-600 hover:underline">
            View Job Posting
          </a>
        </div>
      )}
    </div>
  );
}