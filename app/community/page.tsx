import {auth} from "@clerk/nextjs/server";
import {redirect} from "next/navigation";
import CommunityLookup from "@/components/CommunityLookup";
import CommunityConsent from "@/components/CommunityConsent";
export const metadata = {title: "Community sharing | Interview Tools"};
export default async function CommunityPage() {
  const {userId} = await auth(); if (!userId) redirect("/");
  return <div className="space-y-5"><CommunityLookup /><CommunityConsent /></div>;
}
