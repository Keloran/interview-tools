"use client";

import {useQuery} from "@tanstack/react-query";
import {DAY_END_HOUR, DAY_START_HOUR, GAP_BETWEEN_MINUTES, freeWindows} from "@/lib/availability";
import {getBusy} from "@/lib/busy";

const timeFmt = new Intl.DateTimeFormat(undefined, {hour: "numeric", minute: "2-digit"});

// For "can you do 2pm on Tuesday?": the gaps on a day you could fit another interview into
export default function FreeTimes({day}: { day: string }) {
  const {data: busy} = useQuery({queryKey: ["busy", day], queryFn: () => getBusy(day)});
  if (!busy) return null;

  const windows = freeWindows(new Date(`${day}T00:00`), busy);

  return (
    <p className="text-sm text-muted-foreground mt-1" title={`Keeps ${GAP_BETWEEN_MINUTES} minutes between interviews`}>
      {windows.length ? (
        <>
          Free:{" "}
          {windows.map((w, i) => (
            <span key={w.start.toISOString()}>
              {i > 0 && " · "}
              <span className="text-foreground">{timeFmt.format(w.start)}–{timeFmt.format(w.end)}</span>
            </span>
          ))}
        </>
      ) : (
        `No free time between ${DAY_START_HOUR}:00 and ${DAY_END_HOUR}:00`
      )}
    </p>
  );
}
