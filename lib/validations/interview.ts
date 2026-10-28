import { z } from "zod";
import {recruiterSchema} from "@/lib/recruiters";

// Shared validation schema for interview forms
export const interviewFormSchema = z.object({
  ...recruiterSchema.shape,
  stage: z.string().min(1, "Stage is required"),
  companyName: z.string().min(1, "Company name is required"),
  clientCompany: z.string().optional(),
  jobTitle: z.string().min(1, "Job title is required"),
  jobPostingLink: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  date: z.string().optional(),
  time: z.string().optional(),
  interviewer: z.string().optional(),
  locationType: z.enum(["phone", "link"]).optional(),
  interviewLink: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  notes: z.string().optional(),
});

export type InterviewFormData = z.infer<typeof interviewFormSchema>;

// Validation schema for editing interviews
export const editInterviewSchema = z.object({
  clientCompany: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  deadline: z.string().optional(),
  link: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  interviewer: z.string().optional(),
  notes: z.string().optional(),
  jobPostingLink: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  stageMethodId: z.number().optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
}).refine(
  (data) => {
    // Either deadline OR (date AND time) must be provided
    const hasDeadline = !!data.deadline;
    const hasDateTime = !!data.date && !!data.time;
    return hasDeadline || hasDateTime;
  },
  {
    message: "Either deadline or date/time is required",
    path: ["date"],
  }
);

export type EditInterviewData = z.infer<typeof editInterviewSchema>;
