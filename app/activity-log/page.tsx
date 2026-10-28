import {auth} from "@clerk/nextjs/server";
import {redirect} from "next/navigation";
import ActivityLog from "@/components/ActivityLog";
import "./activity-log.css";

export const metadata = {title: "Job search activity log"};
export default async function ActivityLogPage() {
  const {userId} = await auth();
  if (!userId) redirect("/");
  return <ActivityLog />;
}
