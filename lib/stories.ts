import {z} from "zod";

export const STAR_FIELDS = ["situation", "task", "action", "result"] as const;
export const storySchema = z.object({
  title: z.string().trim().min(1).max(200),
  situation: z.string().trim().max(8000).default(""), task: z.string().trim().max(8000).default(""),
  action: z.string().trim().max(8000).default(""), result: z.string().trim().max(8000).default(""),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]).transform((tags) => [...new Set(tags.map((tag) => tag.toLowerCase()))]),
});
export type StoryInput = z.infer<typeof storySchema>;
export type Story = StoryInput & {id: number; usedIn: {interviewId: number; company: string; stage: string}[]};
export const prepSchema = z.object({notes: z.string().max(12000), storyIds: z.array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)).max(30).transform((ids) => [...new Set(ids)])});
export type Prep = z.infer<typeof prepSchema>;

const TOPICS: Record<string, RegExp> = {
  leadership: /\b(leadership|led|leading|leader|mentoring|mentor)\b/i,
  conflict: /\b(conflict|disagreement|disagreed|disagree|dispute)\b/i,
  failure: /\b(failure|failed|mistake|wrong)\b/i,
  delivery: /\b(delivery|deadline|deadlines|delivered|shipped)\b/i,
  teamwork: /\b(teamwork|collaborat\w*|team)\b/i,
  communication: /\b(communication|communicat\w*|stakeholder\w*)\b/i,
};
export function questionTopics(questions: string[]): string[] {
  return Object.entries(TOPICS).filter(([, pattern]) => questions.some((question) => pattern.test(question))).map(([topic]) => topic);
}
export function suggestedStories(stories: Story[], topics: string[]): Story[] {
  const tags = new Set(topics.map((topic) => topic.toLowerCase()));
  return stories.filter((story) => story.tags.some((tag) => tags.has(tag.toLowerCase())));
}
