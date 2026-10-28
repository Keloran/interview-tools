import React, {type ReactNode} from "react";
import {ActivityRow, activityTotals} from "@/lib/activityLog";

export default function ActivityPrint({rows, from, through, renderActions}: {rows: ActivityRow[]; from: string; through: string; renderActions?: (row: ActivityRow) => ReactNode}) {
  const totals = activityTotals(rows);
  return <div className="activity-print space-y-3">
    <h2 className="text-xl font-semibold">Job search activity log</h2>
    <p>Period: {from} to {through} (local dates)</p>
    <p className="text-sm">{totals.total} {totals.total === 1 ? "activity" : "activities"} · Applications: {totals.applied} · Interviews / assessment deadlines: {totals.interviews} · Follow-ups: {totals.followUps} · Availability sent: {totals.availability} · Other: {totals.other}</p>
    <p className="text-xs">Dates describe recorded applications, scheduled interviews or assessment deadlines, logged follow-ups, explicitly recorded sends and your own entries. Outcomes are current records; a scheduled event is not proof of attendance.</p>
    {!rows.length ? <p>No activity recorded in this period.</p> : <div className="activity-table-wrap overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Date", "Activity", "Employer", "Role", "How", "Outcome", "Notes"].map((label) => <th className="p-2 border-b" key={label}>{label}</th>)}{renderActions && <th className="p-2 border-b no-print">Manage</th>}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}>{[row.date, row.activity, row.employer, row.role, row.how, row.outcome, row.notes].map((value, index) => <td className="p-2 align-top whitespace-pre-wrap break-words" key={index}>{value}</td>)}{renderActions && <td className="p-2 no-print">{renderActions(row)}</td>}</tr>)}</tbody></table></div>}
  </div>;
}
