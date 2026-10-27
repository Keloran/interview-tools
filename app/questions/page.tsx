import {auth} from "@clerk/nextjs/server";
import {redirect} from "next/navigation";
import QuestionBank from "@/components/QuestionBank";

export const metadata = {title: "Question bank"};

export default async function QuestionsPage() {
  const {userId} = await auth();
  if (!userId) redirect("/");
  return <QuestionBank />;
}
