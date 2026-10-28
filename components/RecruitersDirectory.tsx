"use client";

import Link from "next/link";
import {useState} from "react";
import {useUser} from "@clerk/nextjs";
import {useQuery} from "@tanstack/react-query";
import {getCompanies} from "@/components/Company";
import {Card} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Collapsible, CollapsibleTrigger, CollapsibleContent} from "@/components/ui/collapsible";
import {ChevronDown} from "lucide-react";
import RecruiterRecord from "@/components/RecruiterRecord";
import {recruiterRecords} from "@/lib/recruiters";

export default function RecruitersDirectory() {
  const {user} = useUser();
  const [query, setQuery] = useState("");
  const {data, error, isPending} = useQuery({queryKey: ["companies", user?.id], queryFn: getCompanies, enabled: !!user});
  if (!user) return null;
  const q = query.trim().toLowerCase();
  const records = recruiterRecords(data ?? []).filter((record) => [record.agency, record.contact?.recruiterName, record.contact?.recruiterEmail, ...record.applications.flatMap((application) => [application.jobTitle, application.clientCompany])].some((value) => value?.toLowerCase().includes(q)));
  return <section className="space-y-4">
    <h2 className="text-xl font-semibold">Recruiters and agencies</h2>
    <p className="text-sm text-muted-foreground">Your own application history, grouped by agency and named contact. Response and ghost rates count settled histories only; waiting roles are excluded. Feedback rates count rejections where you recorded whether feedback was given. A reply followed by silence still counts as a response, using the same rules as company records.</p>
    <Input type="search" aria-label="Search recruiters and agencies" placeholder="Agency, recruiter, email, client or role" value={query} onChange={(event) => setQuery(event.target.value)} />
    {error ? <p role="alert">Could not load recruiter records. Please reload to try again.</p> : isPending ? <p role="status">Loading recruiter records…</p> : !records.length ? <p>No recruiter records found. Add an agency route or recruiter contact to an application.</p> : <ul className="space-y-3">{records.map((record) => <li key={record.key}><Card className="p-4 gap-3">
      <h3 className="font-semibold">{record.contact ? `${record.contact.recruiterName || record.contact.recruiterEmail || "Recruiter"} · ${record.agency}` : record.agency}</h3>
      <p className="text-xs text-muted-foreground">{record.contact ? "Contact record" : "Agency record"}</p>
      {record.contact?.recruiterEmail && <p className="text-sm break-all">{record.contact.recruiterEmail}</p>}
      {record.contact?.recruiterLinkedIn && <Button asChild variant="outline" size="sm" className="self-start"><a href={record.contact.recruiterLinkedIn} target="_blank" rel="noopener noreferrer">LinkedIn profile</a></Button>}
      <RecruiterRecord applications={record.applications} />
      <Collapsible className="group/roles"><CollapsibleTrigger asChild><Button variant="outline" size="sm">Roles put forward<ChevronDown aria-hidden="true" className="transition-transform group-data-[state=open]/roles:rotate-180" /></Button></CollapsibleTrigger><CollapsibleContent><ul className="mt-2 space-y-2">{record.applications.map((application) => <li key={application.id} className="text-sm"><Button asChild variant="outline" size="sm" className="h-auto max-w-full whitespace-normal text-left"><Link href={`/companies?q=${encodeURIComponent(record.agency)}`}>{application.jobTitle}{application.clientCompany && ` · ${application.clientCompany}`}</Link></Button><p className="text-muted-foreground">{application.status}</p></li>)}</ul></CollapsibleContent></Collapsible>
    </Card></li>)}</ul>}
  </section>;
}
