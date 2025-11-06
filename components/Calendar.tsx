"use client";

import { useAppStore } from "@/lib/store";
import {useMemo, useState} from "react";
import {Button} from "@/components/ui/button";
import {ChevronLeft, ChevronRight, Plus} from "lucide-react";
import {Card} from "@/components/ui/card";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Label} from "@/components/ui/label";
import {Input} from "@/components/ui/input";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {cn} from "@/lib/utils";

interface Event {
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

const STAGE_COLORS: Record<string, string> = {
  Applied: "bg-gray-500",
  "Phone Screen": "bg-blue-500",
  "Technical Interview": "bg-purple-500",
  "Onsite Interview": "bg-orange-500",
  "Final Round": "bg-pink-500",
  Offer: "bg-green-500",
}

export default function Calendar() {
  const selectedDay = useAppStore((s) => s.selectedDay);
  const setSelectedDay = useAppStore((s) => s.setSelectedDay);

  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [filteredDate, setFilteredDate] = useState<Date | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newEventTitle, setNewEventTitle] = useState("")
  const [newEventStage, setNewEventStage] = useState("Applied")

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

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    )
  }

  const getEventsForDay = (day: number) => {
    const date = new Date(year, month, day)
    return events.filter((event) => isSameDay(event.date, date))
  }

  const handleDateClick = (day: number) => {
    const date = new Date(year, month, day)
    setFilteredDate(date)
  }

  const handlePlusClick = (day: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const date = new Date(year, month, day)
    setSelectedDate(date)
    setIsDialogOpen(true)
  }

  const handleAddEvent = () => {
    if (newEventTitle.trim() && selectedDate) {
      const newEvent: Event = {
        id: Math.random().toString(36).substr(2, 9),
        title: newEventTitle,
        date: selectedDate,
        color: STAGE_COLORS[newEventStage],
        stage: newEventStage,
      }
      setEvents([...events, newEvent])
      setNewEventTitle("")
      setNewEventStage("Applied")
      setIsDialogOpen(false)
    }
  }

  const handleDeleteEvent = (eventId: string) => {
    setEvents(events.filter((e) => e.id !== eventId))
  }

  const displayedEvents = filteredDate ? events.filter((event) => isSameDay(event.date, filteredDate)) : events

  const days = []
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="aspect-square" />)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEvents = getEventsForDay(day)
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
        {dayEvents.length > 0 && (
          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
            {dayEvents.slice(0, 2).map((event) => (
              <div key={event.id} className={cn("w-1 h-1 rounded-full", event.color)} />
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
              Add Event for{" "}
              {selectedDate?.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="event-title">Event Title</Label>
              <Input
                id="event-title"
                placeholder="Enter event title"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddEvent()
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-stage">Interview Stage</Label>
              <Select value={newEventStage} onValueChange={setNewEventStage}>
                <SelectTrigger id="event-stage">
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
            <Button onClick={handleAddEvent} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Event
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </>
  );
}
