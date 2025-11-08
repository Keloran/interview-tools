"use client";

import { useAppStore } from "@/lib/store";
import {useMemo, useState, MouseEvent} from "react";
import {Button} from "@/components/ui/button";
import {ChevronLeft, ChevronRight, ChevronsUpDown, Plus} from "lucide-react";
import {Card} from "@/components/ui/card";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Label} from "@/components/ui/label";
import {Input} from "@/components/ui/input";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {cn, STAGE_COLORS, toISODate, isSameDay} from "@/lib/utils";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {useQuery} from "@tanstack/react-query";
import {useUser} from "@clerk/nextjs";
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem} from "@/components/ui/command";

async function getCompanies() {
  const res = await fetch(`/api/companies`, {
    method: "GET",
  })

  if (!res.ok) {
    throw new Error("Failed to fetch companies from client")
  }

  return await res.json() as [string]
}

interface Interview {
  id: string
  title: string
  date: Date
  color: string
  stage: string
  // Optional UI-only metadata (not persisted yet)
  companyName?: string
  jobTitle?: string
  jobPostingLink?: string
  interviewer?: string
  locationType?: "phone" | "link"
  interviewLink?: string
}

const DAYS = ["S", "M", "T", "W", "T", "F", "S"]
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const INTERVIEW_STAGES = ["Applied", "First Stage", "Initial Interview", "Phone Screen", "Technical Interview", "Onsite Interview", "Final Round", "Offer"]

export default function Calendar() {
  const filteredDateISO = useAppStore((s) => s.filteredDate);
  const setFilteredDateISO = useAppStore((s) => s.setFilteredDate);

  const filteredDate = filteredDateISO ? new Date(filteredDateISO + "T00:00:00") : null;

  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState("09:00:00")
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newInterviewTitle, setNewInterviewTitle] = useState("")
  const [newInterviewStage, setNewInterviewStage] = useState("Applied")
  const [companyName, setCompanyName] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [jobPostingLink, setJobPostingLink] = useState("")
  const [interviewer, setInterviewer] = useState("")
  const [locationType, setLocationType] = useState<"phone" | "link">("phone")
  const [interviewLink, setInterviewLink] = useState("")
  const {user} = useUser()
  const [companyOpen, setCompanyOpen] = useState(false)
  const [searchCompanyValue, setSearchCompanyValue] = useState("")

  console.info("interviews", interviews)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startingDayOfWeek = firstDayOfMonth.getDay()

  const {data: companies, error} = useQuery({
    queryKey: ["companies", user?.id],
    queryFn: getCompanies,
  })

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const today = new Date()
  const isToday = (day: number) => {
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
  }

  const getInterviewsForDay = (day: number) => {
    const date = new Date(year, month, day)
    return interviews.filter((interview) => isSameDay(interview.date, date))
  }

  const handleDateClick = (day: number) => {
    const date = new Date(year, month, day)
    setFilteredDateISO(toISODate(date))
  }

  const handlePlusClick = (day: number, e: MouseEvent) => {
    e.stopPropagation()
    const date = new Date(year, month, day)
    setSelectedDate(date)
    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setNewInterviewTitle("")
    setNewInterviewStage("Applied")
    setCompanyName("")
    setJobTitle("")
    setJobPostingLink("")
    setInterviewer("")
    setLocationType("phone")
    setInterviewLink("")
    setSelectedTime("09:00:00")
  }

  const handleAddInterview = () => {
    if (!selectedDate) return

    const isApplied = newInterviewStage === "Applied"
    const isEarlyStage = newInterviewStage === "First Stage" || newInterviewStage === "Initial Interview"

    // Basic validation per requirements
    if (!companyName.trim() || !jobTitle.trim()) {
      return
    }
    if (isApplied) {
      // jobPostingLink optional for now
    }
    if (isEarlyStage) {
      if (!selectedTime || !interviewer.trim()) {
        return
      }
      if (locationType === "link" && !interviewLink.trim()) {
        return
      }
    }

    const dateWithTime = new Date(selectedDate)
    const [hours, minutes, seconds] = selectedTime.split(":").map(Number)
    dateWithTime.setHours(hours || 0, minutes || 0, seconds || 0, 0)

    const composedTitle = `${companyName} — ${jobTitle}`

    const newInterview: Interview = {
      id: Math.random().toString(36).substr(2, 9),
      title: composedTitle,
      date: dateWithTime,
      color: STAGE_COLORS[newInterviewStage],
      stage: newInterviewStage,
      companyName,
      jobTitle,
      jobPostingLink: jobPostingLink || undefined,
      interviewer: isEarlyStage ? interviewer : undefined,
      locationType: isEarlyStage ? locationType : undefined,
      interviewLink: isEarlyStage && locationType === "link" ? interviewLink : undefined,
    }

    setInterviews([...interviews, newInterview])
    resetForm()
    setIsDialogOpen(false)
  }

  const days = []
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="aspect-square" />)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dayInterviews = getInterviewsForDay(day)
    const date = new Date(year, month, day)
    const isFiltered = filteredDate && isSameDay(date, filteredDate)

    days.push(
      <div
        key={day}
        onClick={() => handleDateClick(day)}
        className={cn(
          `aspect-square p-1 rounded-md border border-border hover:bg-accent transition-colors relative group text-xs day-${day}`,
          isToday(day) && "bg-primary text-primary-foreground hover:bg-primary/90",
          isFiltered && "ring-2 ring-primary",
        )}
      >
        <div className="flex items-start justify-between">
          <span className="font-medium">{day}</span>
          <Button
            variant={"ghost"}
            onClick={(e) => handlePlusClick(day, e)}
            className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 cursor-pointer"
          >
            <Plus className="h-1 w-1" />
          </Button>
        </div>
        {dayInterviews.length > 0 && (
          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
            {dayInterviews.slice(0, 2).map((interview) => (
              <div key={interview.id} className={cn("w-1 h-1 rounded-full", interview.color)} />
            ))}
          </div>
        )}
      </div>,
    )
  }

  const max = useMemo(() => {
    // allow picking up to 1 year ahead for now
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  return (
    <>
      <div className="lg:w-80">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {MONTHS[month]} {year}
            </h3>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={previousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS.map((day, i) => (
              <div key={`${day}-${i}`} className="text-center text-xs font-medium text-muted-foreground py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">{days}</div>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add Interview for{" "}
              {selectedDate?.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="interview-stage">Interview Stage</Label>
              <Select value={newInterviewStage} onValueChange={setNewInterviewStage}>
                <SelectTrigger id="interview-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_STAGES.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Shared fields: company name, job title, job posting link */}
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
                        <Button onClick={() => setCompanyName(searchCompanyValue)}>{searchCompanyValue}</Button>
                      </CommandEmpty>
                      <CommandGroup>
                        {companies?.map((company, i) => (
                          <CommandItem key={`${i}-${company}`} value={company} onSelect={(currentValue) => {
                            setCompanyName(currentValue)
                            setCompanyOpen(false)
                          }}>
                            {company}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
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

            {/* Early stage specific fields */}
            {(newInterviewStage === "First Stage" || newInterviewStage === "Initial Interview") && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="interview-time">Interview time</Label>
                  <Input
                    id="interview-time"
                    step={1}
                    type="time"
                    placeholder="09:00:00"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
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
                  <Select value={locationType} onValueChange={(v) => setLocationType(v as any)}>
                    <SelectTrigger id="location-type">
                      <SelectValue />
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
              </div>
            )}

            <Button onClick={handleAddInterview} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Interview Stage
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </>
  );
}
