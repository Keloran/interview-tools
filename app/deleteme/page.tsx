import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DeleteMePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">Delete Account</h2>
      <p className="text-muted-foreground">
        This page will allow you to delete your account and all associated data.
      </p>
      {/* Future functionality will be added here */}
    </div>
  );
}