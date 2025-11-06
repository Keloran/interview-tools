import { create } from "zustand";

// We store the selected day as an ISO date string (YYYY-MM-DD) to keep it
// serializable and easy to compare/filter against interview dates.
export type ISODate = string; // e.g. "2025-11-06"

export type AppState = {
  filteredDate: ISODate | null;
};

export type AppActions = {
  setFilteredDate: (day: ISODate | null) => void;
};

export const useAppStore = create<AppState & AppActions>((set) => ({
  filteredDate: null,
  setFilteredDate: (day) => set({ filteredDate: day }),
}));
