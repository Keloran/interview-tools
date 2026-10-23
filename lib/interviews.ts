import type {Prisma} from "@/app/generated/prisma/client";

export const interviewSelect = {
  id: true,
  interviewer: true,
  date: true,
  deadline: true,
  outcome: true,
  notes: true,
  link: true,
  stage: { select: { id: true, stage: true } },
  stageMethod: { select: { id: true, method: true } },
  application: {
    select: {
      id: true,
      jobTitle: true,
      clientCompany: true,
      applicationDate: true,
      jobPostingLink: true,
      company: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.InterviewSelect;

type InterviewRow = Prisma.InterviewGetPayload<{ select: typeof interviewSelect }>;

// Flattened to the pre-Application response shape so the frontend didn't need to change
export function toInterviewDto({ application, ...interview }: InterviewRow) {
  return {
    ...interview,
    applicationId: application.id,
    jobTitle: application.jobTitle,
    clientCompany: application.clientCompany,
    applicationDate: application.applicationDate,
    company: application.company,
    metadata: application.jobPostingLink ? { jobListing: application.jobPostingLink } : null,
  };
}
