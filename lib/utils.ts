import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toISODate (d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function isSameDay (date1: Date, date2: Date) {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  )
}

export const getStageColor = (outcome: string) => {
  switch (outcome) {
    case "PASSED":
    case "OFFER_ACCEPTED":
      return "bg-green-500";
    case "REJECTED":
    case "WITHDREW":
      return "bg-red-500";
    case "OFFER_RECEIVED":
      return "bg-orange-600";
    case "OFFER_DECLINED":
    case "AWAITING_RESPONSE":
      return "bg-purple-500";
    default:
      return "bg-blue-500";
  }
}

export function inferStageMethodName(locationType?: string | null, interviewLink?: string | null): string {
  if (locationType === "phone") return "Phone";
  if (!interviewLink) return "Link";

  const candidates: { re: RegExp; name: string }[] = [
    { re: /zoom\.us|zoom\.com/i, name: "Zoom" },
    { re: /zoomgov\.com/i, name: "ZoomGov" },
    { re: /teams\.microsoft\.com|microsoft\.teams|live\.com\/meet/i, name: "Teams" },
    { re: /meet\.google\.com|hangouts\.google\.com|google\.com\/hangouts|workspace\.google\.com\/products\/meet/i, name: "Google Meet" },
    { re: /webex\.com|webex/i, name: "Webex" },
    { re: /skype\.com/i, name: "Skype" },
    { re: /bluejeans\.com/i, name: "BlueJeans" },
    { re: /whereby\.com/i, name: "Whereby" },
    { re: /jitsi\.org|meet\.jit\.si/i, name: "Jitsi" },
    { re: /gotomeet|gotowebinar|goto\.com/i, name: "GoToMeeting" },
    { re: /chime\.aws|amazonchime\.com/i, name: "Amazon Chime" },
    { re: /slack\.com/i, name: "Slack" },
    { re: /discord\.(gg|com)/i, name: "Discord" },
    { re: /facetime|apple\.com\/facetime/i, name: "FaceTime" },
    { re: /whatsapp\.com/i, name: "WhatsApp" },
    { re: /(^|\.)8x8\.vc/i, name: "8x8" },
    { re: /telegram\.(me|org)|(^|\/)t\.me\//i, name: "Telegram" },
    { re: /signal\.org/i, name: "Signal" },
  ];

  const raw = String(interviewLink);
  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    try {
      host = new URL(`https://${raw}`).hostname;
    } catch {
      host = "";
    }
  }
  const normalizedHost = host.replace(/^www\./i, "");

  const match = candidates.find((c) => c.re.test(normalizedHost) || c.re.test(raw));
  return match ? match.name : "Link";
}