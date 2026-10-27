import RoadmapEmbed from "@/components/RoadmapEmbed";

export const metadata = {title: "Roadmap"};

export default function RoadmapPage() {
  return (
    <div className="mx-auto max-w-3xl p-4">
      <RoadmapEmbed />
    </div>
  );
}
