import {auth} from "@clerk/nextjs/server";
import {redirect} from "next/navigation";
import HaveIApplied from "@/components/HaveIApplied";

export const metadata = {title: "Have I applied?"};

export default async function CheckPage() {
  const {userId} = await auth();
  if (!userId) redirect("/");
  return <HaveIApplied />;
}
