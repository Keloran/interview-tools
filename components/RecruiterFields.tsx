"use client";

import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {emptyContact} from "@/lib/recruiters";

export type ContactFields = typeof emptyContact;
export default function RecruiterFields({value, onChange, disabled = false, agency, error}: {value: ContactFields; onChange: (value: ContactFields) => void; disabled?: boolean; agency: string; error?: string}) {
  return <fieldset disabled={disabled} className="space-y-3 rounded-md border p-3">
    <legend className="px-1 text-sm font-medium">Recruiter or agency</legend>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.viaRecruiter} onChange={(event) => onChange({...value, viaRecruiter: event.target.checked})} />Via a recruiter or agency</label>
    <p className="text-xs text-muted-foreground">For agency applications, use the agency as the company and the employer as the client company. A client company also marks an agency route.</p>
    {value.viaRecruiter && <>
      <p className="text-sm">Agency: {agency || "Choose the company above"}</p>
      {([['recruiterName', 'Recruiter name (optional)', 'text'], ['recruiterEmail', 'Recruiter email (optional)', 'email'], ['recruiterLinkedIn', 'Recruiter LinkedIn (optional)', 'url']] as const).map(([field, label, type]) => <div key={field} className="space-y-1"><Label htmlFor={field}>{label}</Label><Input id={field} type={type} value={value[field]} onChange={(event) => onChange({...value, [field]: event.target.value})} /></div>)}
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </fieldset>;
}
