"use client";

import {FormEvent, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {useUser} from "@clerk/nextjs";
import {useRouter} from "next/navigation";
import {Search} from "lucide-react";
import Link from "next/link";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import InterviewForm from "@/components/InterviewForm";
import {getCompanies} from "@/components/Company";
import {findPreviousApplications} from "@/lib/applications";
import PreviousApplications from "@/components/PreviousApplications";
import {isLink} from "@/lib/jobLinks";
import {useAppStore} from "@/lib/store";
import {cn} from "@/lib/utils";
import {checkJobListing} from "@/lib/jobChecks";
import {ListingImport} from "@/lib/listingImport";

type Query = { text: string; title: string; description: string; company: string };

// "Have I applied for this?" before you've decided to: paste the listing's link, or type the company and title
export default function HaveIApplied({withDescription = false, initialListing}: {withDescription?: boolean; initialListing?: ListingImport | null}) {
  const {user} = useUser();
  const router = useRouter();
  const setCompanyFilter = useAppStore((s) => s.setFilteredCompany);
  const {data: companies, error} = useQuery({queryKey: ["companies", user?.id], queryFn: getCompanies, enabled: !!user?.id});
  const [text, setText] = useState(initialListing?.url ?? "");
  const [title, setTitle] = useState(initialListing?.title ?? "");
  const [companyHint, setCompanyHint] = useState(initialListing?.company ?? "");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState<Query | null>(initialListing ? {text: initialListing.url, title: initialListing.title, company: initialListing.company, description: ""} : null);
  const [adding, setAdding] = useState(false);

  if (!user) return null;

  const link = query && isLink(query.text) ? query.text.trim() : "";
  const company = query ? (link ? query.company : query.text).trim() : "";
  const matches = query ? findPreviousApplications(companies ?? [], company, "", query.title, link) : [];
  const applied = matches.some((m) => m.samePosting || m.sameTitle);
  const flags = query && withDescription ? checkJobListing({
    description: query.description, history: companies, companyName: company,
    jobTitle: query.title, jobPostingLink: link,
  }) : [];
  const canCheck = !!(text.trim() || (withDescription && description.trim())) && !!companies;

  const check = (e: FormEvent) => {
    e.preventDefault();
    if (canCheck) setQuery({text, title, description: withDescription ? description : "", company: companyHint});
  };
  const checkButton = <Button type="submit" className="cursor-pointer" disabled={!canCheck}><Search /> Check</Button>;

  return (
    <Card className="p-4 gap-3">
      {withDescription && <div>
        <h2 className="font-semibold">Before you apply</h2>
        <p className="text-sm text-muted-foreground">Check your history with a job link or company, and paste the description to check the listing for warning signs.</p>
      </div>}
      <form onSubmit={check} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
          aria-label="Job link or company"
          placeholder={withDescription ? "Job link or company (optional)" : "Have I applied? Paste the job link, or type the company"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="sm:flex-[2]"
          />
          <Input
          aria-label="Job title"
          placeholder="Job title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="sm:flex-1"
          />
          {!withDescription && checkButton}
        </div>
        {withDescription && <>
          {isLink(text) && <div className="space-y-2">
            <Label htmlFor="listing-company">Company or recruiter (optional)</Label>
            <Input id="listing-company" value={companyHint} onChange={(e) => setCompanyHint(e.target.value)} />
          </div>}
          <div className="space-y-2">
            <Label htmlFor="job-description">Job description</Label>
            <Textarea id="job-description" rows={7} maxLength={30000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Paste the job description here" />
            <p className="text-xs text-muted-foreground">A link checks your saved application history. Paste the text to check salary, assessments and role requirements. Technology-age checks cover React, TypeScript and Go.</p>
          </div>
          <div>{checkButton}</div>
        </>}
      </form>
      {error && <p role="alert" className="text-sm text-destructive">Could not load your application history. Refresh the page to try again.</p>}
      {!withDescription && <Link href="/check" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">Check a job description</Link>}

      {query && !companies && !error && <p role="status">Checking your saved applications…</p>}
      {query && companies && !error && (
        <div role="status" className={cn("rounded-md border p-3 text-sm", applied ? "border-amber-500/50 bg-amber-500/10" : "bg-muted/30")}>
          {(link || company) && <p className="font-medium">
            {applied
              ? "Yes, you've applied for this"
              : matches.length
                ? `Not for this role, but you've applied to ${company || "them"} before`
                : "No matching application found"}
          </p>}
          {withDescription && <div className="space-y-3 mt-2">
            {flags.length ? <ul className="space-y-3">
              {flags.map((flag) => <li key={flag.id}>
                <p className="font-medium">{flag.title}</p>
                <p className="text-muted-foreground">{flag.explanation}</p>
                {flag.evidence && <blockquote className="mt-1 border-l-2 pl-3 text-muted-foreground whitespace-pre-wrap">{flag.evidence}</blockquote>}
                {flag.source && <a href={flag.source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Release history</a>}
              </li>)}
            </ul> : <p className="font-medium text-green-700 dark:text-green-400">
              {query.description.trim() ? "No warning signs found in the text you provided." : "No warning signs found in your matching history."}
            </p>}
            {!query.description.trim() && <p className="text-muted-foreground">Paste the job description to check the listing itself.</p>}
          </div>}
          {matches.length > 0 && (
            <PreviousApplications
              applications={matches.slice(0, 8)}
              onShow={(m) => {
                // the application shows in the list on the home page, filtered to its company
                setCompanyFilter(m.companyName);
                router.push("/");
              }}
            />
          )}
          {!applied && (link || company) && (
            <Button size="sm" variant="outline" className="mt-3 cursor-pointer" onClick={() => setAdding(true)}>
              Add it
            </Button>
          )}
        </div>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add application</DialogTitle>
          </DialogHeader>
          {adding && (
            <InterviewForm
              initialDate={new Date()}
              initialValues={{companyName: company, jobTitle: query?.title.trim() ?? "", jobPostingLink: link}}
              onSuccess={() => {
                setAdding(false);
                setQuery(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
