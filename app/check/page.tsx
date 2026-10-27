import {auth} from "@clerk/nextjs/server";
import {redirect} from "next/navigation";
import HaveIApplied from "@/components/HaveIApplied";

export const metadata = {title: "Before you apply"};

export default async function CheckPage() {
  const {userId} = await auth();
  if (!userId) redirect("/");
  return <HaveIApplied withDescription />;
}
