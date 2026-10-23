import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const DAY_MS = 24 * 60 * 60 * 1000;

async function getStalledApplications(clerkId: string) {
  // Applied 30+ days ago and nothing has moved: every stage is still awaiting a response
  const applications = await prisma.application.findMany({
    where: {
      user: { clerkId },
      applicationDate: { lt: new Date(Date.now() - 30 * DAY_MS) },
      interviews: { every: { OR: [{ outcome: "AWAITING_RESPONSE" }, { outcome: null }] } },
    },
    select: {
      id: true,
      jobTitle: true,
      clientCompany: true,
      applicationDate: true,
      company: { select: { name: true } },
      interviews: { select: { stage: { select: { stage: true } } }, orderBy: { created_at: "desc" }, take: 1 },
    },
    orderBy: { applicationDate: "asc" },
  });

  return applications.map((a) => ({
    id: a.id,
    companyName: a.clientCompany || a.company.name,
    jobTitle: a.jobTitle,
    applicationDate: a.applicationDate.toISOString().split("T")[0],
    daysSinceApplication: Math.floor((Date.now() - a.applicationDate.getTime()) / DAY_MS),
    lastStage: a.interviews[0]?.stage.stage ?? "Applied",
  }));
}

export default async function NoFeedbackPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const stalledApplications = await getStalledApplications(userId);

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