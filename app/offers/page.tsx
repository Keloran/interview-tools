import {auth} from "@clerk/nextjs/server";
import {redirect} from "next/navigation";
import Offers from "@/components/Offers";

export const metadata = {title: "Offers and reply deadlines"};
export default async function OffersPage() {
  const {userId} = await auth();
  if (!userId) redirect("/");
  return <Offers />;
}
