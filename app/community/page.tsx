import {auth} from "@clerk/nextjs/server";
import {redirect} from "next/navigation";
import CommunityConsent from "@/components/CommunityConsent";
export const metadata = {title: "Community sharing | Interview Tools"};
export default async function CommunityPage() {
  const {userId} = await auth(); if (!userId) redirect("/");
  return <CommunityConsent />;
}
