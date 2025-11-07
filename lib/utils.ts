import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const STAGE_COLORS: Record<string, string> = {
  Applied: "bg-gray-500",
  "First Stage": "bg-blue-500",
  "Initial Interview": "bg-indigo-500",
  "Phone Screen": "bg-blue-500",
  "Technical Interview": "bg-purple-500",
  "Onsite Interview": "bg-orange-500",
  "Final Round": "bg-pink-500",
  Offer: "bg-green-500",
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