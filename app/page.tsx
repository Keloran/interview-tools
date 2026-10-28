import Calendar from "@/components/Calendar";
import InterviewsList from "@/components/InterviewsList";
import Stats from "@/components/Stats";
import HaveIApplied from "@/components/HaveIApplied";
import {OfferReminders} from "@/components/Offers";

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <HaveIApplied />
      <OfferReminders />
      <div className="flex gap-6 flex-col lg:flex-row">
        <InterviewsList />
        <div className="flex flex-col gap-6">
          <Calendar />
          <Stats />
        </div>
      </div>
    </div>
  );
}
