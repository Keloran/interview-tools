import {Button} from "@/components/ui/button";
import {PreviousApplication, timeAgo} from "@/lib/applications";
import {cn} from "@/lib/utils";
import Link from "next/link";

// Colour the outcome so a scan down the list tells the story
function statusTone(a: PreviousApplication): string {
  if (a.status.startsWith("Rejected")) return "bg-destructive/15 text-destructive";
  if (a.status.startsWith("Offer")) return "bg-green-500/15 text-green-600 dark:text-green-400";
  if (a.response === "ghosted") return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

// Past applications that match, one per row: the role, where and when, and how it ended
export default function PreviousApplications({applications, onShow}: {
  applications: PreviousApplication[];
  onShow?: (a: PreviousApplication) => void;
}) {
  return (
    <ul className="mt-2 divide-y divide-border/60">
      {applications.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className={cn("font-medium truncate", !(a.samePosting || a.sameTitle) && "text-muted-foreground")}>
              {a.jobTitle}
              {a.samePosting && (
                <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-normal text-amber-600 dark:text-amber-400">
                  Same posting
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {a.clientCompany ? `${a.clientCompany} via ${a.companyName}` : `${a.companyName}, direct`}
              {" · applied "}{timeAgo(a.applicationDate)}
              {onShow && (
                <Button variant="link" size="sm" className="ml-2 h-auto p-0 text-xs cursor-pointer" onClick={() => onShow(a)}>
                  Show
                </Button>
              )}
            </p>
            <Link className="text-xs underline underline-offset-2" href={`/applications/${a.id}`}>View application timeline</Link>
          </div>
          <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", statusTone(a))}>{a.status}</span>
        </li>
      ))}
    </ul>
  );
}
