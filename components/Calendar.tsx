"use client";

import {useAppStore} from "@/lib/store";
import {MouseEvent, useEffect, useState} from "react";
import {Button} from "@/components/ui/button";
import {CalendarHeart, ChevronLeft, ChevronRight, Plus} from "lucide-react";
import {Card} from "@/components/ui/card";
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog";
import {cn, getStageColor, isSameDay, toISODate} from "@/lib/utils";
import InterviewForm from "@/components/InterviewForm";
import {useRouter} from "next/navigation";
import {useUser} from "@clerk/nextjs";
import {listGuestInterviews} from "@/lib/guestStorage";
import {useFlags} from "@flags-gg/react-library";
import CalendarSync from "@/components/CalendarSync";
import {useQuery} from "@tanstack/react-query";


interface Interview {
  id: string
  title: string
  date: Date
  color: string
  stage: string
  // Optional UI-only metadata (not persisted yet)
  companyName?: string
  clientCompany?: string
  jobTitle?: string
  jobPostingLink?: string
  interviewer?: string
  locationType?: "link" | "phone"
  interviewLink?: string
}

const DAYS = ["M", "T", "W", "T", "F", "S", "S"]
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


export default function Calendar() {
  const filteredDateISO = useAppStore((s) => s.filteredDate);
  const setFilteredDateISO = useAppStore((s) => s.setFilteredDate);

  const filteredDate = filteredDateISO ? new Date(filteredDateISO + "T00:00:00") : null;

  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [isAddInterviewOpen, setIsAddInterviewOpen] = useState(false)
  const { user } = useUser()

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  // Adjust for Monday start (0 = Monday, 6 = Sunday)
  const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7
  const router = useRouter()
  const {is} = useFlags()

  // Fetch interviews for logged-in users
  const {data: apiInterviews} = useQuery({
    queryKey: ["interviews", user?.id],
    queryFn: async () => {
      const url = new URL('/api/interviews', window.location.origin);
      url.searchParams.set('includePast', 'true'); // Get all interviews for calendar
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch interviews");
      return await res.json();
    },
    enabled: !!user?.id,
  });

  // Update interviews state when API data changes (for logged-in users)
  useEffect(() => {
    if (user && apiInterviews) {
      const mapped: Interview[] = apiInterviews.map((item: any) => ({
        id: String(item.id),
        title: `${item.company.name} — ${item.jobTitle}`,
        date: new Date((item.date ?? item.deadline) as string),
        color: getStageColor(item.outcome ?? item.stage?.stage ?? "Unknown"),
        stage: item.outcome ?? item.stage?.stage ?? "Unknown",
        companyName: item.company.name,
        clientCompany: item.clientCompany,
        jobTitle: item.jobTitle,
        interviewer: item.interviewer,
        interviewLink: item.link,
      }));
      setInterviews(mapped);
    }
  }, [user, apiInterviews]);

  useEffect(() => {
    if (!user) {
      const locals = listGuestInterviews();
      if (locals.length) {
        const mapped: Interview[] = locals.map((g) => ({
          id: g.id,
          title: `${g.companyName} — ${g.jobTitle}`,
          date: g.date ? new Date(g.date) : new Date(),
          color: getStageColor(g.stage),
          stage: g.stage,
          companyName: g.companyName,
          clientCompany: g.clientCompany,
          jobTitle: g.jobTitle,
          jobPostingLink: g.jobPostingLink,
          interviewer: g.interviewer,
          locationType: g.locationType,
          interviewLink: g.interviewLink,
        }));
        setInterviews(mapped);
      }

      const onChanged = () => {
        const localsNow = listGuestInterviews();
        const mappedNow: Interview[] = localsNow.map((g) => ({
          id: g.id,
          title: `${g.companyName} — ${g.jobTitle}`,
          date: g.date ? new Date(g.date) : new Date(),
          color: getStageColor(g.stage),
          stage: g.stage,
          companyName: g.companyName,
          clientCompany: g.clientCompany,
          jobTitle: g.jobTitle,
          jobPostingLink: g.jobPostingLink,
          interviewer: g.interviewer,
          locationType: g.locationType,
          interviewLink: g.interviewLink,
        }));
        setInterviews(mappedNow);
      };
      const handleGuestChanged = () => onChanged();
      window.addEventListener("guest:interviews:changed", handleGuestChanged);
      return () => window.removeEventListener("guest:interviews:changed", handleGuestChanged);
    }
  }, [user]);

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
    setIsAddInterviewOpen(true)
  }


  const days = []
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="aspect-square" />)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dayInterviews = getInterviewsForDay(day)
    const date = new Date(year, month, day)
    const isFiltered = filteredDate && isSameDay(date, filteredDate)

    console.info("dayInterviews", dayInterviews, day, interviews)

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
              <div key={interview.id} className={cn("w-1 h-1 rounded-full", getStageColor(interview.stage))} />
            ))}
          </div>
        )}
      </div>,
    )
  }


  return (
    <>
      <div className="lg:w-80">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {MONTHS[month]} {year}
            </h3>
            <div className="flex gap-1">
              {is("calendar sync").enabled() && (
                <Dialog>
                  <DialogTrigger><CalendarHeart className="h-4 w-4 cursor-pointer" /></DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Calendar Sync</DialogTitle>
                    </DialogHeader>
                    <CalendarSync />
                  </DialogContent>
                </Dialog>
              )}
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

      <Dialog open={isAddInterviewOpen} onOpenChange={setIsAddInterviewOpen}>
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
            <InterviewForm
              submitLabel="Add Interview Stage"
              initialDate={selectedDate || undefined}
              onSuccess={() => {
                setIsAddInterviewOpen(false);
                router.refresh();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
      </>
  );
}
