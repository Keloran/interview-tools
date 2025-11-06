"use client";

import { useAppStore } from "@/lib/store";
import {useMemo, useState, MouseEvent} from "react";
import {Button} from "@/components/ui/button";
import {ChevronLeft, ChevronRight, Plus} from "lucide-react";
import {Card} from "@/components/ui/card";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Label} from "@/components/ui/label";
import {Input} from "@/components/ui/input";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {cn, STAGE_COLORS, toISODate, isSameDay} from "@/lib/utils";

interface Interview {
  id: string
  title: string
  date: Date
  color: string
  stage: string
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

const INTERVIEW_STAGES = ["Applied", "Phone Screen", "Technical Interview", "Onsite Interview", "Final Round", "Offer"]

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

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startingDayOfWeek = firstDayOfMonth.getDay()

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

  const handleAddInterview = () => {
    if (newInterviewTitle.trim() && selectedDate) {
      const dateWithTime = new Date(selectedDate)
      const [hours, minutes, seconds] = selectedTime.split(':').map(Number)
      dateWithTime.setHours(hours, minutes, seconds, 0)
      const newInterview: Interview = {
        id: Math.random().toString(36).substr(2, 9),
        title: newInterviewTitle,
        date: dateWithTime,
        color: STAGE_COLORS[newInterviewStage],
        stage: newInterviewStage,
      }
      setInterviews([...interviews, newInterview])
      setNewInterviewTitle("")
      setNewInterviewStage("Applied")
      setIsDialogOpen(false)
      setSelectedTime("09:00:00")
    }
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
            onClick={(e) => handlePlusClick(day, e)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Plus className="h-3 w-3" />
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
              <Label htmlFor="interview-title">Interview Title</Label>
              <Input
                id="interview-title"
                placeholder="Enter interview title"
                value={newInterviewTitle}
                onChange={(e) => setNewInterviewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddInterview()
                  }
                }}
              />
            </div>
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
              <Input
                id={"interview-time"}
                step={1}
                type={"time"}
                placeholder={"09:00:00"}
                value={"09:00:00"}
                onChange={(e) => setSelectedTime(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddInterview()
                  }
                }} />
            </div>
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
