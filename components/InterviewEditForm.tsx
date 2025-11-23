"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { editInterviewSchema, type EditInterviewData } from "@/lib/validations/interview";
import { deriveMethodFromLink } from "@/lib/utils/interviewMethod";

type EditFormValues = EditInterviewData;

interface InterviewEditFormProps {
  interviewId: string;
  onSuccess?: () => void;
}

interface InterviewData {
  id: number;
  jobTitle: string;
  interviewer: string | null;
  company: { id: number; name: string };
  clientCompany: string | null;
  stage: { id: number; stage: string };
  stageMethod: { id: number; method: string } | null;
  // Some API responses may also include a flattened stageMethodId
  stageMethodId?: number;
  date: string | null;
  deadline: string | null;
  link: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
}

interface StageMethod {
  id: number;
  method: string;
}

async function getInterview(id: string) {
  const res = await fetch(`/api/interview/${id}`);
  if (!res.ok) {
    throw new Error("Failed to fetch interview");
  }
  return await res.json();
}

async function getStageMethods() {
  const res = await fetch("/api/stage-methods");
  if (!res.ok) {
    throw new Error("Failed to fetch stage methods");
  }
  return await res.json() as StageMethod[];
}

export default function InterviewEditForm({ interviewId, onSuccess }: InterviewEditFormProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: interview, isLoading } = useQuery<InterviewData>({
    queryKey: ["interview", interviewId],
    queryFn: () => getInterview(interviewId),
    enabled: !!interviewId,
  });

  const { data: stageMethods } = useQuery<StageMethod[]>({
    queryKey: ["stage-methods"],
    queryFn: getStageMethods,
  });

  const { register, handleSubmit, formState: { errors }, reset, control } = useForm<EditFormValues>({
    resolver: zodResolver(editInterviewSchema),
    defaultValues: {
      clientCompany: "",
      date: "",
      time: "",
      deadline: "",
      link: "",
      interviewer: "",
      notes: "",
      jobPostingLink: "",
      stageMethodId: undefined,
    },
  });

  // Track if this interview has a deadline
  const hasDeadline = !!interview?.deadline;

  // Reset form when interview data loads
  useEffect(() => {
    if (interview && stageMethods) {
      const interviewDate = interview.date ? new Date(interview.date) : null;
      const deadlineDate = interview.deadline ? new Date(interview.deadline) : null;

      // Format date as YYYY-MM-DD for date input
      const formattedDate = interviewDate
        ? interviewDate.toISOString().split('T')[0]
        : "";

      // Format time as HH:MM for time input (using local timezone)
      const formattedTime = interviewDate
        ? interviewDate.toTimeString().slice(0, 5)
        : "";

      // Format deadline as YYYY-MM-DDTHH:MM for datetime-local input
      const formattedDeadline = deadlineDate
        ? deadlineDate.toISOString().slice(0, 16)
        : "";

      // Determine the correct stageMethodId with robust fallbacks
      // 1) Nested object id
      // 2) Flat stageMethodId from API (if present)
      // 3) Resolve by method name if nested object has method string
      let stageMethodId: number | undefined = interview.stageMethod?.id ?? interview.stageMethodId;
      if (!stageMethodId && interview.stageMethod?.method) {
        const match = stageMethods.find((m) => m.method === interview.stageMethod?.method);
        stageMethodId = match?.id;
      }
      // 4) As a last resort, try to infer from the meeting link
      if (!stageMethodId && interview.link) {
        const inferred = deriveMethodFromLink(interview.link);
        if (inferred) {
          const match = stageMethods.find((m) => m.method === inferred);
          stageMethodId = match?.id;
        }
      }

      reset({
        clientCompany: interview.clientCompany || "",
        date: formattedDate,
        time: formattedTime,
        deadline: formattedDeadline,
        link: interview.link || "",
        interviewer: interview.interviewer || "",
        notes: interview.notes || "",
        jobPostingLink: (interview.metadata as { jobListing?: string })?.jobListing || "",
        stageMethodId: stageMethodId,
      });
    }
  }, [interview, stageMethods, reset]);

  const onSubmit = async (values: EditFormValues) => {
    setIsSubmitting(true);
    try {
      // Combine date and time OR use deadline
      const dateTime = values.date && values.time
        ? new Date(`${values.date}T${values.time}`)
        : null;

      const deadline = values.deadline
        ? new Date(values.deadline)
        : null;

      const metadata = {
        ...(interview?.metadata || {}),
        jobListing: values.jobPostingLink || undefined,
      };

      const res = await fetch(`/api/interview/${interviewId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientCompany: values.clientCompany || null,
          date: dateTime?.toISOString() || null,
          deadline: deadline?.toISOString() || null,
          link: values.link || null,
          interviewer: values.interviewer || null,
          notes: values.notes || null,
          metadata,
          stageMethodId: values.stageMethodId || null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update interview");
      }

      // Invalidate queries to refetch data
      await queryClient.invalidateQueries({ queryKey: ["interviews"] });
      await queryClient.invalidateQueries({ queryKey: ["interview", interviewId] });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Failed to update interview:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  if (!interview) {
    return <div className="text-center py-4">Interview not found</div>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Readonly Fields */}
      <div>
        <Label>Job Title (readonly)</Label>
        <Input value={interview.jobTitle} disabled className="bg-muted" />
      </div>

      <div>
        <Label>Stage (readonly)</Label>
        <Input value={interview.stage.stage} disabled className="bg-muted" />
      </div>

      {/* Editable Fields */}
      <div>
        <Label htmlFor="clientCompany">Company Name</Label>
        <Input
          id="clientCompany"
          {...register("clientCompany")}
          placeholder="Specific company name (if different from agency)"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Agency: {interview.company.name}
        </p>
      </div>

      {/* Show deadline OR date/time based on interview type */}
      {hasDeadline ? (
        <div>
          <Label htmlFor="deadline">Deadline</Label>
          <Input
            id="deadline"
            type="datetime-local"
            {...register("deadline")}
          />
          {errors.deadline && (
            <p className="text-xs text-destructive mt-1">{errors.deadline.message}</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              {...register("date")}
            />
            {errors.date && (
              <p className="text-xs text-destructive mt-1">{errors.date.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              {...register("time")}
            />
            {errors.time && (
              <p className="text-xs text-destructive mt-1">{errors.time.message}</p>
            )}
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="interviewer">Interviewer Name</Label>
        <Input
          id="interviewer"
          {...register("interviewer")}
          placeholder="Name of the interviewer"
        />
      </div>

      <div>
        <Label htmlFor="stageMethod">Interview Method</Label>
        <Controller
          name="stageMethodId"
          control={control}
          render={({ field }) => {
            return (
              <Select
                value={field.value ? field.value.toString() : ""}
                onValueChange={(value) => {
                  field.onChange(parseInt(value, 10));
                }}
              >
                <SelectTrigger id="stageMethod">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {stageMethods?.map((method) => {
                    return (
                      <SelectItem key={method.id} value={method.id.toString()}>
                        {method.method}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            );
          }}
        />
        {errors.stageMethodId && (
          <p className="text-xs text-destructive mt-1">{errors.stageMethodId.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="link">Interview Link</Label>
        <Input
          id="link"
          type="url"
          {...register("link")}
          placeholder="Zoom, Teams, or Google Meet link"
        />
        {errors.link && (
          <p className="text-xs text-destructive mt-1">{errors.link.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="jobPostingLink">Job Posting Link</Label>
        <Input
          id="jobPostingLink"
          type="url"
          {...register("jobPostingLink")}
          placeholder="Link to job posting"
        />
        {errors.jobPostingLink && (
          <p className="text-xs text-destructive mt-1">{errors.jobPostingLink.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          {...register("notes")}
          placeholder="Add any notes about this interview..."
          rows={4}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
