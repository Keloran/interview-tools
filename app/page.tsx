import Calendar from "@/components/Calendar";
import InterviewsList from "@/components/InterviewsList";

export default function Home() {
  return (
    <div className="flex gap-6 flex-col lg:flex-row">
      <InterviewsList />
      <Calendar />
    </div>
  );
}
