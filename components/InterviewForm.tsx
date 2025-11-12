"use client";

import {useState} from "react";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Input} from "@/components/ui/input";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem} from "@/components/ui/command";
import {ChevronsUpDown, Plus} from "lucide-react";
import {useQuery} from "@tanstack/react-query";
import {useUser} from "@clerk/nextjs";

export type LocationType = "phone" | "link";

export type InterviewFormValues = {
  stage: string;
  companyName: string;
  clientCompany?: string;
  jobTitle: string;
  jobPostingLink?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm:ss
  interviewer?: string;
  locationType?: LocationType;
  interviewLink?: string;
  notes?: string;
};

export type InterviewFormProps = {
  initialValues?: Partial<InterviewFormValues>;
  onSubmit: (values: InterviewFormValues) => void;
  submitLabel?: string;
  isProgressing?: boolean; // When true, shows date picker for scheduling next stage
};

interface Company {
  name: string;
  id: number;
}

interface Stage {
  id: number;
  stage: string;
}

// Fallback stages for unsigned (guest) users
const guestStages: Stage[] = [
  { id: 1, stage: "Phone Screen" },
  { id: 2, stage: "First Stage" },
  { id: 3, stage: "Second Stage" },
  { id: 4, stage: "Technical Test" },
  { id: 5, stage: "Third Stage" },
  { id: 6, stage: "Fourth Stage" },
  { id: 7, stage: "Final Stage" },
  { id: 8, stage: "Applied" },
  { id: 9, stage: "Technical Interview" },
];

async function getCompanies() {
  const res = await fetch(`/api/companies`, { method: "GET" });
  if (!res.ok) throw new Error("Failed to fetch companies from client");
  return (await res.json()) as Company[];
}

async function getStages() {
  const res = await fetch(`/api/stages`, { method: "GET" });
  if (!res.ok) throw new Error("Failed to fetch stages from client");
  return (await res.json()) as Stage[];
}

export default function InterviewForm({ initialValues, onSubmit, submitLabel = "Add Interview Stage", isProgressing = false }: InterviewFormProps) {
  const [stage, setStage] = useState<InterviewFormValues["stage"]>(initialValues?.stage || "Applied");
  const [companyName, setCompanyName] = useState(initialValues?.companyName || "");
  const [clientCompany, setClientCompany] = useState(initialValues?.clientCompany || "");
  const [jobTitle, setJobTitle] = useState(initialValues?.jobTitle || "");
  const [jobPostingLink, setJobPostingLink] = useState(initialValues?.jobPostingLink || "");
  const [date, setDate] = useState(initialValues?.date || "");
  const [time, setTime] = useState(initialValues?.time || "09:00:00");
  const [interviewer, setInterviewer] = useState(initialValues?.interviewer || "");
  const [locationType, setLocationType] = useState<LocationType>(initialValues?.locationType || "phone");
  const [interviewLink, setInterviewLink] = useState(initialValues?.interviewLink || "");
  const [notes, setNotes] = useState(initialValues?.notes || "");

  const [companyOpen, setCompanyOpen] = useState(false);
  const [searchCompanyValue, setSearchCompanyValue] = useState("");

  const { user } = useUser();
  const { data: companies } = useQuery({ queryKey: ["companies"], queryFn: getCompanies, enabled: !!user?.id });
  const { data: stages } = useQuery({ queryKey: ["stages"], queryFn: getStages, enabled: !!user?.id });

  const effectiveStages: Stage[] | undefined = user ? stages : guestStages;

  // Compute a default stage without causing setState inside an effect
  const defaultStage = ((): string => {
    if (!effectiveStages || effectiveStages.length === 0) return "Applied";
    const applied = effectiveStages.find((s) => s.stage.toLowerCase() === "applied");
    return applied ? applied.stage : effectiveStages[0].stage;
  })();

  const selectedStage = stage || defaultStage;

  // All stages except "Applied" and "Offer" require scheduling (time, interviewer, etc.)
  const isTechnicalTest = selectedStage === "Technical Test";
  const requiresScheduling = selectedStage !== "Applied" && selectedStage !== "Offer";

  const handleSubmit = () => {
    // Basic validation (mirrors Calendar.tsx rules)
    if (!companyName.trim() || !jobTitle.trim()) return;
    if (requiresScheduling) {
      if (!isTechnicalTest) {
        if (!time || !interviewer.trim()) return;
        if (locationType === "link" && !interviewLink.trim()) return;
      }
      if (isProgressing && !date) return; // Require date when progressing (deadline for Technical Test)
    }

    onSubmit({
      stage: selectedStage,
      companyName,
      clientCompany: clientCompany || undefined,
      jobTitle,
      jobPostingLink: jobPostingLink || undefined,
      date: date || undefined,
      time,
      interviewer: requiresScheduling && !isTechnicalTest ? interviewer : undefined,
      locationType: requiresScheduling && !isTechnicalTest ? locationType : undefined,
      interviewLink: requiresScheduling && !isTechnicalTest && locationType === "link" ? interviewLink : undefined,
      notes: isTechnicalTest ? (notes || undefined) : undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="interview-stage">Interview Stage</Label>
        <Select value={selectedStage} onValueChange={(v) => setStage(v as InterviewFormValues["stage"])}>
          <SelectTrigger id="interview-stage">
            <SelectValue placeholder={effectiveStages ? "Select a stage" : "Loading..."} />
          </SelectTrigger>
          <SelectContent>
            {effectiveStages
              ?.filter((s) => {
                // When progressing, exclude "Applied" since we've already passed that stage
                return !(isProgressing && s.stage === "Applied");

              })
              .map((s) => (
                <SelectItem key={s.id} value={s.stage}>{s.stage}</SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-1">
          <Label htmlFor="company-name">Company name</Label>
          <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
            <PopoverTrigger asChild>
              <Button variant={"outline"} role={"combobox"} className={"w-[200px] justify-between"}>
                {companyName !== "" ? companyName : "Company"}
                <ChevronsUpDown className="opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <Command>
                <CommandInput placeholder={"Search Company"} onValueChange={(e) => setSearchCompanyValue(e)} />
                <CommandEmpty>
                  <Button onClick={() => {
                    setCompanyName(searchCompanyValue)}
                  }>{searchCompanyValue}</Button>
                </CommandEmpty>
                <CommandGroup>
                  {companies?.map((c) => (
                    <CommandItem
                      key={`interview-company-${c.id}`}
                      value={c.name}
                      onSelect={(currentValue) => {
                        setCompanyName(currentValue);
                        setCompanyOpen(false);
                      }}
                    >
                      {c.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2 md:col-span-1">
          <Label htmlFor="client-company">Client company (optional)</Label>
          <Input
            id="client-company"
            placeholder="e.g. End client if via recruiter"
            value={clientCompany}
            onChange={(e) => setClientCompany(e.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-1">
          <Label htmlFor="job-title">Job title</Label>
          <Input
            id="job-title"
            placeholder="e.g. Senior Frontend Engineer"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="job-posting-link">Job posting link</Label>
          <Input
            id="job-posting-link"
            type="url"
            placeholder="https://..."
            value={jobPostingLink}
            onChange={(e) => setJobPostingLink(e.target.value)}
          />
        </div>
      </div>

      {requiresScheduling && (
        <div className="grid gap-4 md:grid-cols-2">
          {isProgressing && (
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="interview-date">{isTechnicalTest ? "Deadline" : "Interview date"}</Label>
              <Input
                id="interview-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          )}

          {!isTechnicalTest && (
            <>
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="interview-time">Interview time</Label>
                <Input
                  id="interview-time"
                  step={1}
                  type="time"
                  placeholder="09:00:00"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="interviewer">Interviewer</Label>
                <Input
                  id="interviewer"
                  placeholder="Who are you meeting?"
                  value={interviewer}
                  onChange={(e) => setInterviewer(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="location-type">Interview location</Label>
                <Select value={locationType} onValueChange={(v) => setLocationType(v as LocationType)}>
                  <SelectTrigger id="location-type">
                    <SelectValue/>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="link">Link (online meeting)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {locationType === "link" && (
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="interview-link">Interview link</Label>
                  <Input
                    id="interview-link"
                    type="url"
                    placeholder="https://meet..."
                    value={interviewLink}
                    onChange={(e) => setInterviewLink(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {isTechnicalTest && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Anything you need to remember for the test (requirements, repo link to submit, etc.)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      <Button onClick={handleSubmit} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        {submitLabel}
      </Button>
    </div>
  );
}
