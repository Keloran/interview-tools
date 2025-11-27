import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface InterviewWithRelations {
  id: number;
  date: Date | null;
  deadline: Date | null;
  jobTitle: string;
  clientCompany: string | null;
  interviewer: string | null;
  notes: string | null;
  link: string | null;
  outcome: string | null;
  company: {
    name: string;
  };
  stage: {
    stage: string;
  };
}

function formatDateForICal(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeICalText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function generateICalEvent(interview: InterviewWithRelations): string {
  const uid = `interview-${interview.id}@interviews.app`;
  const dtstamp = formatDateForICal(new Date());

  // Determine event date and if it's all-day
  let dtstart: string;
  let dtend: string;
  let isAllDay = false;

  if (interview.deadline) {
    // For deadlines, create an all-day event
    const deadlineDate = new Date(interview.deadline);
    dtstart = deadlineDate.toISOString().split('T')[0].replace(/-/g, '');
    dtend = dtstart;
    isAllDay = true;
  } else if (interview.date) {
    // For scheduled interviews, use the specific time
    const startDate = new Date(interview.date);
    dtstart = formatDateForICal(startDate);
    // Assume 1 hour duration
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    dtend = formatDateForICal(endDate);
  } else {
    // No date/deadline - skip this interview
    return '';
  }

  // Build event title
  const companyName = interview.clientCompany || interview.company.name;
  const summary = escapeICalText(`Interview: ${interview.jobTitle} - ${companyName}`);

  // Build description
  const descriptionParts = [
    `Stage: ${interview.stage.stage}`,
  ];
  if (interview.interviewer) {
    descriptionParts.push(`Interviewer: ${interview.interviewer}`);
  }
  if (interview.notes) {
    descriptionParts.push(`\\nNotes: ${interview.notes}`);
  }
  const description = escapeICalText(descriptionParts.join('\\n'));

  // Location (interview link if available)
  const location = interview.link ? escapeICalText(interview.link) : '';

  let event = 'BEGIN:VEVENT\r\n';
  event += `UID:${uid}\r\n`;
  event += `DTSTAMP:${dtstamp}\r\n`;

  if (isAllDay) {
    event += `DTSTART;VALUE=DATE:${dtstart}\r\n`;
    event += `DTEND;VALUE=DATE:${dtend}\r\n`;
  } else {
    event += `DTSTART:${dtstart}\r\n`;
    event += `DTEND:${dtend}\r\n`;
  }

  event += `SUMMARY:${summary}\r\n`;
  event += `DESCRIPTION:${description}\r\n`;

  if (location) {
    event += `LOCATION:${location}\r\n`;
  }

  // Add status based on outcome
  if (interview.outcome === 'SCHEDULED') {
    event += 'STATUS:CONFIRMED\r\n';
  }

  // Add 30-minute reminder for scheduled interviews (not all-day deadline events)
  if (!isAllDay) {
    event += 'BEGIN:VALARM\r\n';
    event += 'ACTION:DISPLAY\r\n';
    event += 'DESCRIPTION:Interview in 30 minutes\r\n';
    event += 'TRIGGER:-PT30M\r\n';
    event += 'END:VALARM\r\n';
  }

  event += 'END:VEVENT\r\n';

  return event;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;

    // Find user by calendar UUID
    const user = await prisma.user.findUnique({
      where: { calendarUuid: uuid },
    });

    if (!user) {
      return new NextResponse('Calendar not found', { status: 404 });
    }

    // Fetch only SCHEDULED interviews for this user that have a date or deadline
    const interviews = await prisma.interview.findMany({
      where: {
        userId: user.id,
        outcome: 'SCHEDULED',
        OR: [
          { date: { not: null } },
          { deadline: { not: null } },
        ],
      },
      include: {
        company: true,
        stage: true,
        stageMethod: true,
      },
      orderBy: [
        { date: 'asc' },
        { deadline: 'asc' },
      ],
    });

    // Generate iCal file
    let ical = 'BEGIN:VCALENDAR\r\n';
    ical += 'VERSION:2.0\r\n';
    ical += 'PRODID:-//Interview Tracker//Calendar//EN\r\n';
    ical += 'CALSCALE:GREGORIAN\r\n';
    ical += 'METHOD:PUBLISH\r\n';
    ical += 'X-WR-CALNAME:Interview Schedule\r\n';
    ical += 'X-WR-TIMEZONE:UTC\r\n';

    // Add each interview as an event
    for (const interview of interviews) {
      const event = generateICalEvent(interview);
      if (event) {
        ical += event;
      }
    }

    ical += 'END:VCALENDAR\r\n';

    // Return iCal file with proper headers
    return new NextResponse(ical, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="interviews.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating calendar:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}