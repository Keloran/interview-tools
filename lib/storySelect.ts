import {Prisma} from "@/app/generated/prisma/client";
import {Story} from "@/lib/stories";

export function storySelect(clerkId: string) {
  return {id: true, title: true, situation: true, task: true, action: true, result: true, tags: true,
    interviews: {where: {interview: {application: {user: {clerkId}}}}, select: {interview: {select: {id: true, stage: {select: {stage: true}}, application: {select: {clientCompany: true, company: {select: {name: true}}}}}}}},
  } satisfies Prisma.StorySelect;
}
type Selected = Prisma.StoryGetPayload<{select: ReturnType<typeof storySelect>}>;
export function toStory({interviews, ...story}: Selected): Story {
  return {...story, usedIn: interviews.map(({interview}) => ({interviewId: interview.id, stage: interview.stage.stage, company: interview.application.clientCompany || interview.application.company.name}))};
}
