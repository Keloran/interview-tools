import {auth} from "@clerk/nextjs/server";
import {redirect} from "next/navigation";
import RecruitersDirectory from "@/components/RecruitersDirectory";

export const metadata = {title: "Recruiters and agencies"};
export default async function RecruitersPage() {
  const {userId} = await auth();
  if (!userId) redirect("/");
  return <RecruitersDirectory />;
}
