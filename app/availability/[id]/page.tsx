import {notFound} from "next/navigation";
import prisma from "@/lib/prisma";
import {openSlots} from "@/lib/availability";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import BookingPicker from "@/components/BookingPicker";

async function getLink(id: string) {
  const link = await prisma.availabilityLink.findUnique({
    where: {id},
    select: {
      slots: true,
      durationMinutes: true,
      bookedSlot: true,
      stage: {select: {stage: true}},
      application: {
        select: {
          userId: true,
          jobTitle: true,
          clientCompany: true,
          company: {select: {name: true}},
          user: {select: {name: true}},
        },
      },
    },
  });
  if (!link) return null;

  const busy = await prisma.interview.findMany({
    where: {application: {userId: link.application.userId}, outcome: "SCHEDULED", date: {not: null}},
    select: {date: true, durationMinutes: true},
  });

  return {
    ...link,
    open: openSlots(link.slots, link.durationMinutes, busy.map((b) => ({start: b.date!, durationMinutes: b.durationMinutes}))).map((d) => d.toISOString()),
  };
}

export default async function AvailabilityPage({params}: { params: Promise<{ id: string }> }) {
  const {id} = await params;
  const link = await getLink(id);
  if (!link) notFound();

  const {application, stage} = link;
  const who = application.user.name ?? "the candidate";

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Pick a time to meet {who}</CardTitle>
        <CardDescription>
          {stage.stage} · {application.jobTitle} at {application.clientCompany || application.company.name} · {link.durationMinutes} minutes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BookingPicker
          linkId={id}
          slots={link.open}
          bookedSlot={link.bookedSlot?.toISOString() ?? null}
        />
      </CardContent>
    </Card>
  );
}
