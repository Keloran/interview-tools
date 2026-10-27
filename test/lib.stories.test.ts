import {describe, expect, it} from "vitest";
import {prepSchema, questionTopics, storySchema, suggestedStories, Story} from "@/lib/stories";

describe("story validation", () => {
  it("supports partial STAR answers and normalises tags without duplicates", () => {
    expect(storySchema.parse({title: " A difficult deadline ", action: "Shipped", tags: [" Delivery ", "delivery"]})).toEqual({title: "A difficult deadline", situation: "", task: "", action: "Shipped", result: "", tags: ["delivery"]});
  });
  it.each([{title: " "}, {title: "a", action: "x".repeat(8001)}, {title: "a", tags: [""]}, {title: "a", tags: Array(13).fill("tag")}, {title: "a", tags: ["x".repeat(41)]}])("rejects invalid story fields", (body) => expect(storySchema.safeParse(body).success).toBe(false));
  it("does not allow ownership fields from a client", () => expect(storySchema.parse({title: "Story", userId: 999})).not.toHaveProperty("userId"));
  it("requires complete preparation updates and bounds identifiers and notes", () => {
    expect(prepSchema.parse({notes: "Prep", storyIds: [1, 1, 2]}).storyIds).toEqual([1, 2]);
    expect(prepSchema.safeParse({notes: "Prep"}).success).toBe(false);
    expect(prepSchema.safeParse({notes: "", storyIds: [-1]}).success).toBe(false);
    expect(prepSchema.safeParse({notes: "a".repeat(12001), storyIds: []}).success).toBe(false);
  });
});

describe("story suggestions", () => {
  it("tags common question topics and matches story tags rather than unrelated text", () => {
    const topics = questionTopics(["Tell me about a conflict with a stakeholder.", "When did you miss a deadline?"]);
    expect(topics).toEqual(["conflict", "delivery", "communication"]);
    const stories = [{id: 1, tags: ["Conflict"]}, {id: 2, tags: ["leadership"]}] as Story[];
    expect(suggestedStories(stories, topics).map((s) => s.id)).toEqual([1]);
    expect(suggestedStories(stories, [])).toEqual([]);
    expect(questionTopics(["What is your favourite language?"])).toEqual([]);
  });
});
