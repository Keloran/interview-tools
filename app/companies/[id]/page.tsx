import {auth} from "@clerk/nextjs/server";
import {redirect} from "next/navigation";
import CompanyInsights from "@/components/CompanyInsights";

export const metadata = {title: "Company history and insights"};
export default async function CompanyPage({params}: {params: Promise<{id: string}>}) {
  const {userId} = await auth();
  if (!userId) redirect("/");
  return <CompanyInsights companyId={(await params).id} />;
}
