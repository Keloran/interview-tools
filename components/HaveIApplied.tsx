"use client";

import {FormEvent, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {useUser} from "@clerk/nextjs";
import {useRouter} from "next/navigation";
import {Search} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import InterviewForm from "@/components/InterviewForm";
import {getCompanies} from "@/components/Company";
import {findPreviousApplications} from "@/lib/applications";
import PreviousApplications from "@/components/PreviousApplications";
import {isLink} from "@/lib/jobLinks";
import {useAppStore} from "@/lib/store";
import {cn} from "@/lib/utils";

type Query = { text: string; title: string };

// "Have I applied for this?" before you've decided to: paste the listing's link, or type the company and title
export default function HaveIApplied() {
  const {user} = useUser();
  const router = useRouter();
  const setCompanyFilter = useAppStore((s) => s.setFilteredCompany);
  const {data: companies} = useQuery({queryKey: ["companies", user?.id], queryFn: getCompanies, enabled: !!user?.id});
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState<Query | null>(null);
  const [adding, setAdding] = useState(false);

  if (!user) return null;

  const link = query && isLink(query.text) ? query.text.trim() : "";
  const company = query && !link ? query.text.trim() : "";
  const matches = query ? findPreviousApplications(companies ?? [], company, "", query.title, link) : [];
  const applied = matches.some((m) => m.samePosting || m.sameTitle);

  const check = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) setQuery({text, title});
  };

  return (
    <Card className="p-4 gap-3">
      <form onSubmit={check} className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="Job link or company"
          placeholder="Have I applied? Paste the job link, or type the company"
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
        <Button type="submit" className="cursor-pointer" disabled={!text.trim() || !companies}>
          <Search /> Check
        </Button>
      </form>

      {query && (
        <div role="status" className={cn("rounded-md border p-3 text-sm", applied ? "border-amber-500/50 bg-amber-500/10" : "bg-muted/30")}>
          <p className="font-medium">
            {applied
              ? "Yes, you've applied for this"
              : matches.length
                ? `Not for this role, but you've applied to ${company || "them"} before`
                : "No, you haven't applied for this"}
          </p>
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
          {!applied && (
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
