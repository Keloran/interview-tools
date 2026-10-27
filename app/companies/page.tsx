import {Suspense} from "react";
import {auth} from "@clerk/nextjs/server";
import {redirect} from "next/navigation";
import CompaniesDirectory from "@/components/CompaniesDirectory";

export const metadata = {title: "Companies"};

export default async function CompaniesPage() {
  const {userId} = await auth();
  if (!userId) redirect("/");
  // useSearchParams needs a Suspense boundary
  return (
    <Suspense>
      <CompaniesDirectory />
    </Suspense>
  );
}
