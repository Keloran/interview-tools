import {auth} from "@clerk/nextjs/server";
import {redirect} from "next/navigation";
import CompanyInsights from "@/components/CompanyInsights";

export const metadata = {title: "Company insights"};
export default async function InsightsPage() {
  const {userId} = await auth();
  if (!userId) redirect("/");
  return <CompanyInsights />;
}
