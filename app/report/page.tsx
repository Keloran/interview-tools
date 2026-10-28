import {auth} from "@clerk/nextjs/server";
import {redirect} from "next/navigation";
import SearchReport from "@/components/SearchReport";

export const metadata = {title: "Job-search report"};
export default async function ReportPage() {
  const {userId} = await auth();
  if (!userId) redirect("/");
  return <SearchReport />;
}
