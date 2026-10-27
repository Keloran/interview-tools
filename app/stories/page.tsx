import {auth} from "@clerk/nextjs/server";
import {redirect} from "next/navigation";
import StoryBank from "@/components/StoryBank";

export const metadata = {title: "Story bank"};
export default async function StoriesPage({searchParams}: {searchParams: Promise<{q?: string | string[]}>}) {
  const {userId} = await auth();
  if (!userId) redirect("/");
  const {q} = await searchParams;
  return <StoryBank initialSearch={typeof q === "string" ? q.slice(0, 200) : ""} />;
}
