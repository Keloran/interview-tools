"use client";

import {useQuery} from "@tanstack/react-query";
import {useUser} from "@clerk/nextjs";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import {ChevronLeft, ChevronRight, Search} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import PreviousApplications from "@/components/PreviousApplications";
import {getCompanies} from "@/components/Company";
import {responseRecord, searchCompanies, timeAgo} from "@/lib/applications";
import {feedbackRecord} from "@/lib/feedback";
import {useAppStore} from "@/lib/store";

export const PAGE_SIZE = 25;

// Every company you've applied to, A–Z. The search and page are in the URL so a lookup can be linked to.
export default function CompaniesDirectory() {
  const {user} = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const setCompanyFilter = useAppStore((s) => s.setFilteredCompany);
  const {data} = useQuery({queryKey: ["companies", user?.id], queryFn: getCompanies, enabled: !!user?.id});

  const query = params.get("q") ?? "";
  const matches = searchCompanies(data ?? [], query);
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(params.get("page")) || 1), pages);
  const shown = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const go = (next: { q?: string; page?: number }) => {
    const p = new URLSearchParams();
    const q = next.q ?? query;
    if (q) p.set("q", q);
    if ((next.page ?? 1) > 1) p.set("page", String(next.page));
    router.replace(p.size ? `${pathname}?${p}` : pathname, {scroll: false});
  };

  return (
    <Card>
      <CardHeader className="gap-4">
        <CardTitle>Companies{data ? ` (${matches.length})` : ""}</CardTitle>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search companies"
            placeholder="Search by company, client or job title"
            className="pl-8"
            defaultValue={query}
            onChange={(e) => go({q: e.target.value})} // a new search starts at page 1
          />
        </div>
      </CardHeader>
      <CardContent>
        {!data ? (
          <p className="text-muted-foreground text-center py-8">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{query ? `Nothing matches "${query}".` : "You haven't applied anywhere yet."}</p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((c) => {
              const lastApplied = c.applications[0]?.applicationDate; // newest first from the API
              const records = [responseRecord(c.applications), feedbackRecord(c.applications)].filter(Boolean).join(" · ");
              return (
                <li key={c.id}>
                  <details className="group py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.applications.length} application{c.applications.length === 1 ? "" : "s"}
                          {lastApplied && ` · last applied ${timeAgo(lastApplied)}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {records && <span className="text-xs text-muted-foreground text-right">{records}</span>}
                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                      </div>
                    </summary>
                    <div className="mt-2 ml-1 border-l-2 border-border pl-4">
                      <PreviousApplications
                        applications={c.applications.map((a) => ({...a, companyName: c.name, sameTitle: true, samePosting: false}))}
                        onShow={() => {
                          setCompanyFilter(c.name);
                          router.push("/");
                        }}
                      />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
        {pages > 1 && (
          <nav className="flex items-center justify-between pt-4" aria-label="Pages">
            <Button variant="outline" size="sm" className="cursor-pointer" disabled={page === 1} onClick={() => go({page: page - 1})}>
              <ChevronLeft /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
            <Button variant="outline" size="sm" className="cursor-pointer" disabled={page === pages} onClick={() => go({page: page + 1})}>
              Next <ChevronRight />
            </Button>
          </nav>
        )}
      </CardContent>
    </Card>
  );
}
