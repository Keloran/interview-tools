"use client";

import { Button } from "@/components/ui/button";
import { SiGooglemeet, SiZoom } from "react-icons/si";
import { PiMicrosoftTeamsLogoFill } from "react-icons/pi";

// Try to infer a known interview method from a URL/link
export function deriveMethodFromLink(link?: string | null): string | null {
  if (!link) return null;
  const lower = link.toLowerCase();
  if (lower.includes("zoom")) return "Zoom";
  if (lower.includes("teams")) return "Teams";
  if (lower.includes("meet.google") || lower.includes("google.com/meet") || lower.includes("gmeet")) return "Google Meet";
  return null;
}

// Render a small icon button for the interview method which opens the link when clicked
export function getStageMethodButton(stageMethod: string, link: string) {
  switch (stageMethod) {
    case "Zoom": {
      return (
        <Button variant={"outline"} className={"cursor-pointer"} onClick={() => window.open(link)}>
          <SiZoom />
        </Button>
      );
    }
    case "Teams": {
      return (
        <Button variant={"outline"} className={"cursor-pointer"} onClick={() => window.open(link)}>
          <PiMicrosoftTeamsLogoFill />
        </Button>
      );
    }
    case "Google Meet": {
      return (
        <Button variant={"outline"} className={"cursor-pointer"} onClick={() => window.open(link)}>
          <SiGooglemeet />
        </Button>
      );
    }
  }
  return null;
}
