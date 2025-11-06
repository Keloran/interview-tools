"use client";

import { useAppStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, isSameDay } from "@/lib/utils";
import { useState } from "react";
import {X} from "lucide-react";

interface Event {
  id: string;
  title: string;
  date: Date;
  color: string;
  stage: string;
}

export default function InterviewsList() {
  const filteredDateISO = useAppStore((s) => s.filteredDate);
  const setFilteredDate = useAppStore((s) => s.setFilteredDate);

  const filteredDate = filteredDateISO ? new Date(filteredDateISO + "T00:00:00") : null;

  const [currentDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const handleDeleteEvent = (eventId: string) => {
    setEvents(events.filter((e) => e.id !== eventId));
  };

  const displayedEvents = filteredDate
    ? events.filter((event) => isSameDay(event.date, filteredDate))
    : events;

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="aspect-square" />);
  }

  // Placeholder: this would come from Prisma/DB filtered by filteredDate
  // For now just demonstrate the dependency on filteredDate
  return (
    <div className="flex-1">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold">
              {filteredDate
                ? "Events for " +
                  filteredDate.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "All Upcoming Events"}
            </h2>
            {filteredDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilteredDate(null)}
                className="mt-2 h-8"
              >
                <X className="h-3 w-3 mr-1" />
                Clear filter
              </Button>
            )}
          </div>
        </div>

        {displayedEvents.length > 0 ? (
          <div className="space-y-3">
            {displayedEvents
              .sort((a, b) => a.date.getTime() - b.date.getTime())
              .map((event) => (
                <div
                  key={event.id}
                  className="flex items-start justify-between p-4 rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full mt-1 flex-shrink-0",
                        event.color,
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-lg">{event.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {event.date.toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary">
                          {event.stage}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteEvent(event.id)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No events scheduled</p>
            <p className="text-sm mt-1">
              Click the + button on a date to add an event
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
