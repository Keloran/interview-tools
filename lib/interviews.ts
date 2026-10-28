import type {Prisma} from "@/app/generated/prisma/client";
import {orderedStages} from "@/lib/timeline";

export const interviewSelect = {
  id: true,
  parentId: true,
  created_at: true,
  interviewer: true,
  date: true,
  deadline: true,
  durationMinutes: true,
  outcome: true,
  notes: true,
  link: true,
  debriefedAt: true,
  rating: true,
  debriefNotes: true,
  peopleMet: true,
  questionsAsked: true,
  prepNotes: true,
  nextStep: true,
  replyBy: true,
  feedbackType: true,
  feedbackText: true,
  stage: { select: { id: true, stage: true } },
  stageMethod: { select: { id: true, method: true } },
  application: {
    select: {
      id: true,
      viaRecruiter: true,
      recruiterName: true,
      recruiterEmail: true,
      recruiterLinkedIn: true,
      firstResponseAt: true,
      jobTitle: true,
      clientCompany: true,
      applicationDate: true,
      jobPostingLink: true,
      company: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.InterviewSelect;

type InterviewRow = Prisma.InterviewGetPayload<{ select: typeof interviewSelect }>;

export function currentApplicationStages<T extends {id: number; parentId: number | null; created_at: string | Date; application: {id: number}}>(interviews: T[]): T[] {
  const applications = new Map<number, T[]>();
  for (const interview of interviews) applications.set(interview.application.id, [...(applications.get(interview.application.id) ?? []), interview]);
  return [...applications.values()].map((stages) => orderedStages(stages).at(-1)!);
}

// Flattened to the pre-Application response shape so the frontend didn't need to change
export function toInterviewDto({ application, ...interview }: InterviewRow) {
  return {
    ...interview,
    applicationId: application.id,
    viaRecruiter: application.viaRecruiter,
    recruiterName: application.recruiterName,
    recruiterEmail: application.recruiterEmail,
    recruiterLinkedIn: application.recruiterLinkedIn,
    firstResponseAt: application.firstResponseAt,
    jobTitle: application.jobTitle,
    clientCompany: application.clientCompany,
    applicationDate: application.applicationDate,
    company: application.company,
    metadata: application.jobPostingLink ? { jobListing: application.jobPostingLink } : null,
  };
}
