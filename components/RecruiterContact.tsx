"use client";

import {useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {Button} from "@/components/ui/button";
import RecruiterFields from "@/components/RecruiterFields";
import {emptyContact, RecruiterContact as Contact, recruiterSchema} from "@/lib/recruiters";

export default function RecruiterContact({applicationId, agency, clientCompany, contact}: {applicationId: number; agency: string; clientCompany?: string | null; contact: Contact}) {
  const queryClient = useQueryClient();
  const values = () => ({viaRecruiter: !!contact.viaRecruiter || !!clientCompany?.trim(), recruiterName: contact.recruiterName ?? "", recruiterEmail: contact.recruiterEmail ?? "", recruiterLinkedIn: contact.recruiterLinkedIn ?? ""});
  const [draft, setDraft] = useState(emptyContact);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    const parsed = recruiterSchema.safeParse(draft);
    if (!parsed.success) {setError(parsed.error.issues[0].message); return;}
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/applications/${applicationId}/recruiter`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(parsed.data)});
      if (!response.ok) throw new Error();
      await Promise.all(["interview", "interviews", "companies", "application-timeline"].map((key) => queryClient.invalidateQueries({queryKey: [key]})));
      setEditing(false);
    } catch {setError("Could not save recruiter details. Your edits are still here.");}
    finally {setBusy(false);}
  }
  return <div className="space-y-2">
    <h3 className="text-sm font-medium">Recruiter contact</h3>
    {editing ? <>
      <RecruiterFields value={draft} agency={agency} onChange={setDraft} disabled={busy} error={error} />
      <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={save}>Save recruiter details</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button></div>
    </> : <>
      <p className="text-sm">{values().viaRecruiter ? `Via ${agency}` : "Direct application"}{contact.recruiterName && ` · ${contact.recruiterName}`}</p>
      {contact.recruiterEmail && <p className="text-sm break-all">{contact.recruiterEmail}</p>}
      {contact.recruiterLinkedIn && <a className="text-sm underline" href={contact.recruiterLinkedIn} target="_blank" rel="noopener noreferrer">Recruiter LinkedIn profile</a>}
      <div><Button size="sm" variant="outline" onClick={() => {setDraft(values()); setError(""); setEditing(true);}}>Edit recruiter details</Button></div>
    </>}
  </div>;
}
