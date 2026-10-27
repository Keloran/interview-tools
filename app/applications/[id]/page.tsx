import {auth} from "@clerk/nextjs/server";
import {redirect} from "next/navigation";
import ApplicationTimeline from "@/components/ApplicationTimeline";

export const metadata = {title: "Application timeline"};
export default async function ApplicationPage({params}: {params: Promise<{id: string}>}) {
  const {userId} = await auth();
  if (!userId) redirect("/");
  const {id} = await params;
  return <ApplicationTimeline applicationId={id} />;
}
