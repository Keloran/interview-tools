import { create } from "zustand";

// We store the selected day as an ISO date string (YYYY-MM-DD) to keep it
// serializable and easy to compare/filter against interview dates.
export type ISODate = string; // e.g. "2025-11-06"

export type AppState = {
  selectedDay: ISODate | null;
};

export type AppActions = {
  setSelectedDay: (day: ISODate | null) => void;
};

export const useAppStore = create<AppState & AppActions>((set) => ({
  selectedDay: null,
  setSelectedDay: (day) => set({ selectedDay: day }),
}));
