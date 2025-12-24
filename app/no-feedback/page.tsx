import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface StalledApplication {
  id: string;
  companyName: string;
  jobTitle: string;
  applicationDate: string;
  daysSinceApplication: number;
  lastStage: string;
}

// Hardcoded data - will be replaced with database query later
const stalledApplications: StalledApplication[] = [
  {
    id: "1",
    companyName: "TechCorp Inc",
    jobTitle: "Senior Frontend Developer",
    applicationDate: "2024-11-01",
    daysSinceApplication: 53,
    lastStage: "Applied",
  },
  {
    id: "2",
    companyName: "StartupXYZ",
    jobTitle: "Full Stack Engineer",
    applicationDate: "2024-11-10",
    daysSinceApplication: 44,
    lastStage: "Phone Screen",
  },
  {
    id: "3",
    companyName: "MegaSoft",
    jobTitle: "Staff Engineer",
    applicationDate: "2024-11-15",
    daysSinceApplication: 39,
    lastStage: "Applied",
  },
  {
    id: "4",
    companyName: "CloudServices Ltd",
    jobTitle: "Backend Developer",
    applicationDate: "2024-11-20",
    daysSinceApplication: 34,
    lastStage: "Technical Interview",
  },
];

export default function NoFeedbackPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>No Feedback (30+ Days)</CardTitle>
          <CardDescription>
            Companies that haven&apos;t responded to your application in over 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stalledApplications.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No stalled applications found.
            </p>
          ) : (
            <div className="space-y-3">
              {stalledApplications.map((application) => (
                <div
                  key={application.id}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{application.companyName}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground text-sm">
                        {application.jobTitle}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Applied: {application.applicationDate}</span>
                      <span>·</span>
                      <span>Last stage: {application.lastStage}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-amber-500/20 px-3 py-1 text-sm font-medium text-amber-500">
                      {application.daysSinceApplication} days
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}