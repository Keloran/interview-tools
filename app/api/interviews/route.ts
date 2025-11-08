import {currentUser} from "@clerk/nextjs/server";
import {NextRequest, NextResponse} from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({message: "unauthorized"}, {status: 401})
  }

  try {
    const {searchParams} = new URL(request.url)
    const date = searchParams.get("date")
    let interviews

    if (date) {
      const filterDate = new Date(date + "T00:00:00Z")
      const nextDay = new Date(filterDate)
      nextDay.setDate(nextDay.getDate() + 1)

      interviews = await prisma.interview.findMany({
        where: {
          user: {clerkId: user.id},
          date: {
            gte: filterDate,
            lt: nextDay
          }
        },
        select: {
          id: true,
          jobTitle: true,
          interviewer: true,
          company: {
            select: {
              id: true,
              name: true
            }
          },
          stage: {
            select: {
              id: true,
              stage: true
            }
          },
          date: true,
          deadline: true,
          status: true,
          outcome: true,
          notes: true,
          metadata: true,
          link: true
        },
        orderBy: {date: "asc"}
      })
    } else {
      // If no date specified, get all future interviews
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      interviews = await prisma.interview.findMany({
        where: {
          user: {clerkId: user.id},
          date: {
            gte: today
          }
        },
        select: {
          id: true,
          jobTitle: true,
          interviewer: true,
          company: {
            select: {
              id: true,
              name: true
            }
          },
          stage: {
            select: {
              id: true,
              stage: true
            }
          },
          date: true,
          deadline: true,
          status: true,
          outcome: true,
          notes: true,
          metadata: true,
          link: true
        },
        orderBy: {date: "asc"}
      })
    }

    return NextResponse.json(interviews);
  } catch (error) {
    console.log(error);
    return NextResponse.json({message: error}, {status: 500});
  }
}