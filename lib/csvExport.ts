import type {Prisma} from "@/app/generated/prisma/client";
import {EXPORT_FORMAT, writeCSV} from "@/lib/csv";
import type {Story} from "@/lib/stories";

export const applicationExportSelect = {
  id: true, jobTitle: true, clientCompany: true, applicationDate: true, jobPostingLink: true, created_at: true, updated_at: true,
  viaRecruiter: true, recruiterName: true, recruiterEmail: true, recruiterLinkedIn: true,
  company: {select: {id: true, name: true}},
  interviews: {orderBy: [{created_at: "desc"}, {id: "desc"}], select: {
    id: true, parentId: true, date: true, deadline: true, durationMinutes: true, outcome: true, interviewer: true, notes: true, link: true,
    debriefedAt: true, rating: true, debriefNotes: true, peopleMet: true, questionsAsked: true, prepNotes: true, nextStep: true, replyBy: true,
    feedbackType: true, feedbackText: true, created_at: true, updated_at: true,
    stage: {select: {stage: true}}, stageMethod: {select: {method: true}},
  }},
} satisfies Prisma.ApplicationSelect;
type ApplicationExport = Prisma.ApplicationGetPayload<{select: typeof applicationExportSelect}>;
const columns = ["exportFormat", "applicationId", "company", "clientCompany", "jobTitle", "applicationDate", "jobPostingLink", "applicationCreatedAt", "applicationUpdatedAt",
  "interviewId", "previousInterviewId", "stage", "stageMethod", "date", "deadline", "durationMinutes", "outcome", "interviewer", "notes", "meetingLink",
  "debriefedAt", "rating", "debriefNotes", "peopleMet", "questionsAsked", "prepNotes", "nextStep", "replyBy", "feedbackType", "feedbackText", "stageCreatedAt", "stageUpdatedAt", "viaRecruiter", "recruiterName", "recruiterEmail", "recruiterLinkedIn"];

export function exportApplications(applications: ApplicationExport[]): string {
  const rows = applications.flatMap((application) => (application.interviews.length ? application.interviews : [null]).map((stage) => {
    const row: Record<string, string | number | Date | null | undefined> = {
      exportFormat: EXPORT_FORMAT, applicationId: application.id, company: application.company.name, clientCompany: application.clientCompany, jobTitle: application.jobTitle,
      applicationDate: application.applicationDate, jobPostingLink: application.jobPostingLink, applicationCreatedAt: application.created_at, applicationUpdatedAt: application.updated_at,
      interviewId: stage?.id, previousInterviewId: stage?.parentId, stage: stage?.stage.stage, stageMethod: stage?.stageMethod.method, date: stage?.date, deadline: stage?.deadline,
      durationMinutes: stage?.durationMinutes, outcome: stage?.outcome, interviewer: stage?.interviewer, notes: stage?.notes, meetingLink: stage?.link,
      debriefedAt: stage?.debriefedAt, rating: stage?.rating, debriefNotes: stage?.debriefNotes, peopleMet: stage?.peopleMet, questionsAsked: stage?.questionsAsked,
      prepNotes: stage?.prepNotes, nextStep: stage?.nextStep, replyBy: stage?.replyBy, feedbackType: stage?.feedbackType, feedbackText: stage?.feedbackText,
      stageCreatedAt: stage?.created_at, stageUpdatedAt: stage?.updated_at,
      viaRecruiter: application.viaRecruiter ? "true" : "false", recruiterName: application.recruiterName, recruiterEmail: application.recruiterEmail, recruiterLinkedIn: application.recruiterLinkedIn,
    };
    return columns.map((column) => row[column]);
  }));
  return writeCSV([columns, ...rows], true);
}

export function exportStories(stories: Story[]): string {
  return writeCSV([["exportFormat", "storyId", "title", "situation", "task", "action", "result", "tags", "usedIn"],
    ...stories.map((story) => [EXPORT_FORMAT, story.id, story.title, story.situation, story.task, story.action, story.result, JSON.stringify(story.tags), JSON.stringify(story.usedIn)])], true);
}
