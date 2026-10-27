import {auth} from "@clerk/nextjs/server";
import {redirect} from "next/navigation";
import DataTransfer from "@/components/DataTransfer";

export const metadata = {title: "Import and export"};
export default async function DataPage() {
  const {userId} = await auth();
  if (!userId) redirect("/");
  return <DataTransfer />;
}
