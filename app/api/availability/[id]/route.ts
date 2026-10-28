import {NextRequest, NextResponse} from "next/server";
import prisma from "@/lib/prisma";
import {Prisma} from "@/app/generated/prisma/client";
import {inferStageMethodName} from "@/lib/utils";
import {isOfferedSlot, openSlots} from "@/lib/availability";
import {reportError} from "@/lib/bugfixes";
import {externalBusyAroundSlots} from "@/lib/externalBusy";

class BookingError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// Public: whoever was sent the link picks a slot; that schedules the stage on the owner's application
export async function POST(request: NextRequest, {params}: { params: Promise<{ id: string }> }) {
  const {id} = await params;

  try {
    const {slot, name} = (await request.json()) ?? {};
    const start = new Date(String(slot));
    if (isNaN(start.getTime())) {
      return NextResponse.json({message: "Invalid slot"}, {status: 400});
    }

    // The owner's calendar is fetched before the transaction so it never waits on Google
    const owner = await prisma.availabilityLink.findUnique({where: {id}, select: {slots: true, application: {select: {user: {select: {clerkId: true}}}}}});
    const calendar = owner ? await externalBusyAroundSlots(owner.application.user.clerkId, owner.slots) : [];

    const booked = await prisma.$transaction(async (tx) => {
      const link = await tx.availabilityLink.findUnique({
        where: {id},
        select: {
          slots: true,
          durationMinutes: true,
          meetingLink: true,
          stageId: true,
          bookedSlot: true,
          application: {
            select: {
              id: true,
              userId: true,
              interviews: {select: {id: true, outcome: true}, orderBy: {created_at: "desc"}, take: 1},
            },
          },
        },
      });
      if (!link) throw new BookingError("Not found", 404);
      if (link.bookedSlot) throw new BookingError("Already booked", 409);
      if (!isOfferedSlot(link.slots, start)) throw new BookingError("That time wasn't offered", 400);

      const busy = await tx.interview.findMany({
        where: {application: {userId: link.application.userId}, outcome: "SCHEDULED", date: {not: null}, NOT: {stage: {stage: {equals: "Offer", mode: "insensitive"}}}},
        select: {date: true, durationMinutes: true},
      });
      if (!openSlots([start], link.durationMinutes, [...busy.map((b) => ({start: b.date!, durationMinutes: b.durationMinutes})), ...calendar]).length) {
        throw new BookingError("That time is no longer available", 409);
      }

      // Claim the link; a concurrent booking loses here
      const claimed = await tx.availabilityLink.updateMany({where: {id, bookedSlot: null}, data: {bookedSlot: start}});
      if (claimed.count === 0) throw new BookingError("Already booked", 409);

      // Same as progressing in the UI: the stage they're scheduling the next one from has been passed
      const previous = link.application.interviews[0];
      if (previous && (previous.outcome === null || previous.outcome === "SCHEDULED" || previous.outcome === "AWAITING_RESPONSE")) {
        await tx.interview.update({where: {id: previous.id}, data: {outcome: "PASSED"}});
      }

      const methodName = inferStageMethodName(undefined, link.meetingLink);
      const method = await tx.stageMethod.findFirst({
        where: {method: {equals: methodName, mode: Prisma.QueryMode.insensitive}},
        select: {id: true},
      }) ?? await tx.stageMethod.create({data: {method: methodName}, select: {id: true}});

      const interview = await tx.interview.create({
        data: {
          applicationId: link.application.id,
          parentId: previous?.id ?? null,
          stageId: link.stageId,
          stageMethodId: method.id,
          interviewer: typeof name === "string" && name.trim() ? name.trim().slice(0, 200) : null,
          date: start,
          durationMinutes: link.durationMinutes,
          outcome: "SCHEDULED",
          link: link.meetingLink,
        },
        select: {id: true},
      });
      await tx.availabilityLink.update({where: {id}, data: {interviewId: interview.id}});

      return start;
    }, {timeout: 10000});

    return NextResponse.json({bookedSlot: booked}, {status: 201});
  } catch (error) {
    if (error instanceof BookingError) {
      return NextResponse.json({message: error.message}, {status: error.status});
    }
    // P2028: transaction timed out waiting on a concurrent booking; P2034: write conflict
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2028", "P2034"].includes(error.code)) {
      return NextResponse.json({message: "Someone else is booking right now, please try again"}, {status: 409});
    }
    // ponytail: a concurrent booking has occasionally surfaced here as an unclassified error (seen twice, not reproducible);
    // whatever it was, if the link is now booked the honest answer is "already booked". Still reported so we learn what it is.
    const current = await prisma.availabilityLink.findUnique({where: {id}, select: {bookedSlot: true}}).catch(() => null);
    if (current?.bookedSlot) {
      reportError("POST /api/availability/[id] lost a concurrent booking with an unexpected error", error);
      return NextResponse.json({message: "Already booked"}, {status: 409});
    }
    reportError("POST /api/availability/[id] error", error);
    return NextResponse.json({message: "Internal Server Error"}, {status: 500});
  }
}
