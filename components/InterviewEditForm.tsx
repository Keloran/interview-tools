"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { editInterviewSchema, type EditInterviewData } from "@/lib/validations/interview";

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
  date: string | null;
  deadline: string | null;
  link: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
}

async function getInterview(id: string) {
  const res = await fetch(`/api/interview/${id}`);
  if (!res.ok) {
    throw new Error("Failed to fetch interview");
  }
  return await res.json();
}

export default function InterviewEditForm({ interviewId, onSuccess }: InterviewEditFormProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: interview, isLoading } = useQuery<InterviewData>({
    queryKey: ["interview", interviewId],
    queryFn: () => getInterview(interviewId),
    enabled: !!interviewId,
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<EditFormValues>({
    resolver: zodResolver(editInterviewSchema),
    defaultValues: {
      clientCompany: "",
      date: "",
      time: "",
      link: "",
      interviewer: "",
      notes: "",
      jobPostingLink: "",
    },
  });

  // Reset form when interview data loads
  useEffect(() => {
    if (interview) {
      const interviewDate = interview.date ? new Date(interview.date) : null;

      // Format date as YYYY-MM-DD for date input
      const formattedDate = interviewDate
        ? interviewDate.toISOString().split('T')[0]
        : "";

      // Format time as HH:MM for time input (using local timezone)
      const formattedTime = interviewDate
        ? interviewDate.toTimeString().slice(0, 5)
        : "";

      reset({
        clientCompany: interview.clientCompany || "",
        date: formattedDate,
        time: formattedTime,
        link: interview.link || "",
        interviewer: interview.interviewer || "",
        notes: interview.notes || "",
        jobPostingLink: (interview.metadata as { jobListing?: string })?.jobListing || "",
      });
    }
  }, [interview, reset]);

  const onSubmit = async (values: EditFormValues) => {
    setIsSubmitting(true);
    try {
      // Combine date and time
      const dateTime = values.date && values.time
        ? new Date(`${values.date}T${values.time}`)
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
          date: dateTime?.toISOString(),
          link: values.link || null,
          interviewer: values.interviewer || null,
          notes: values.notes || null,
          metadata,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update interview");
      }

      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      queryClient.invalidateQueries({ queryKey: ["interview", interviewId] });

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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            {...register("date", { required: "Date is required" })}
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
            {...register("time", { required: "Time is required" })}
          />
          {errors.time && (
            <p className="text-xs text-destructive mt-1">{errors.time.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="interviewer">Interviewer Name</Label>
        <Input
          id="interviewer"
          {...register("interviewer")}
          placeholder="Name of the interviewer"
        />
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
