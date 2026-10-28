"use client";

import {useState} from "react";
import Link from "next/link";
import {useUser} from "@clerk/nextjs";
import {useQueryClient} from "@tanstack/react-query";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Label} from "@/components/ui/label";
import {CSVTable, MAX_CSV_BYTES, MAX_CSV_ROWS, parseCSV} from "@/lib/csv";
import {ColumnMapping, FIELD_LABELS, guessMapping, IMPORT_FIELDS, ImportPlan, ImportRow} from "@/lib/csvImport";

export default function DataTransfer() {
  const {user} = useUser();
  return user ? <TransferForm key={user.id} /> : null;
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsText(file, "UTF-8");
  });
}

function TransferForm() {
  const queryClient = useQueryClient();
  const [csv, setCSV] = useState("");
  const [table, setTable] = useState<CSVTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [result, setResult] = useState<ImportPlan | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("all");

  async function upload(file?: File) {
    setCSV(""); setTable(null); setMapping(null); setResult(null); setError(""); setPage(0); setFilter("all");
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) {setError("The CSV must be no larger than 2 MB."); return;}
    setBusy("file");
    try {
      const contents = await readFile(file);
      const parsed = parseCSV(contents);
      setCSV(contents); setTable(parsed); setMapping(guessMapping(parsed.headers));
    } catch (err) {setError(err instanceof Error ? err.message : "Could not read the CSV.");}
    finally {setBusy(null);}
  }

  async function check(action: "preview" | "import") {
    if (!mapping) return;
    setBusy(action); setError("");
    try {
      const response = await fetch("/api/data/import", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({csv, mapping, action})});
      const value = await response.json();
      if (!response.ok) throw new Error(value.message ?? "Could not process the import.");
      setResult(value); setPage(0); setFilter("all");
      if (action === "import") await Promise.all(["interviews", "companies", "stats", "follow-ups"].map((key) => queryClient.invalidateQueries({queryKey: [key]})));
    } catch (err) {setError(err instanceof Error ? err.message : "Could not process the import. Please try again.");}
    finally {setBusy(null);}
  }

  async function download(kind: "applications" | "stories") {
    setBusy("export"); setError("");
    try {
      const response = await fetch(`/api/data/export?kind=${kind}`);
      if (!response.ok) throw new Error();
      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = href; link.download = `interview-tools-${kind}.csv`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {setError("Could not download your export. Please try again.");}
    finally {setBusy(null);}
  }

  const rows = result?.rows.filter((row) => filter === "all" || row.status === filter) ?? [];
  const pageSize = 25;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1));
  const labels: Record<ImportRow["status"], string> = {ready: "Ready", duplicate: "Duplicate", error: "Invalid", imported: "Imported"};
  const mapped = !!mapping && [mapping.company, mapping.jobTitle, mapping.applicationDate].every((column) => column !== null);
  return <section className="space-y-6">
    <div><h2 className="text-xl font-semibold">Your data</h2><p className="text-muted-foreground">Bring your application spreadsheet or download your records.</p></div>
    <Card className="p-4 gap-3">
      <h3 className="font-semibold">Export</h3>
      <p className="text-sm text-muted-foreground">Applications export includes every recorded interview stage and its notes. Stories download as a separate CSV.</p>
      <nav aria-label="Data navigation" className="flex flex-wrap gap-2"><Button asChild variant="outline" className="h-auto max-w-full whitespace-normal text-left"><Link href="/community">Manage community sharing and your consent</Link></Button><Button asChild variant="outline" className="h-auto max-w-full whitespace-normal text-left"><Link href="/activity-log">Export your activity log and free entries</Link></Button></nav>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!!busy} onClick={() => download("applications")}>Export applications and stages</Button><Button variant="outline" disabled={!!busy} onClick={() => download("stories")}>Export stories</Button></div>
    </Card>
    <Card className="p-4 gap-4">
      <h3 className="font-semibold">Import applications</h3>
      <p className="text-sm text-muted-foreground">Export your spreadsheet as a comma-separated CSV with a header row. Company, job title and date applied are required. Use YYYY-MM-DD or DD/MM/YYYY dates. Maximum {MAX_CSV_ROWS} rows and 2 MB per file.</p>
      <p className="text-sm text-muted-foreground">Each new application gets an Applied stage. Import does not recreate exported interview history or saved stories. Blank statuses mean Applied; other statuses become the Applied stage&apos;s outcome.</p>
      <div className="space-y-1"><Label htmlFor="import-file">CSV file</Label><input id="import-file" type="file" accept=".csv,text/csv" disabled={!!busy} onChange={(event) => upload(event.target.files?.[0])} /></div>
      {table && mapping && <>
        <p className="text-sm">{table.records.length} data rows found. Choose which CSV column supplies each field.</p>
        <div className="grid gap-3 sm:grid-cols-2">{IMPORT_FIELDS.map((field) => <div key={field} className="space-y-1">
          <Label htmlFor={`map-${field}`}>{FIELD_LABELS[field]}</Label>
          <select id={`map-${field}`} className="h-9 w-full rounded-md border bg-background px-2" disabled={!!busy} value={mapping[field] ?? ""} onChange={(event) => {setMapping({...mapping, [field]: event.target.value === "" ? null : Number(event.target.value)}); setResult(null); setError("");}}>
            <option value="">Choose a column</option>{table.headers.map((header, index) => <option key={index} value={index}>{index + 1}: {header || "Unnamed column"}</option>)}
          </select>
        </div>)}</div>
        <div><Button disabled={!!busy || !mapped} onClick={() => check("preview")}>{busy === "preview" ? "Checking rows…" : "Preview import"}</Button></div>
      </>}
      {result && <>
        <p role="status">{result.ready} ready · {result.imported} imported · {result.duplicates} duplicate · {result.errors} invalid</p>
        {result.ready > 0 && <div className="space-y-2"><p className="text-sm">Import the {result.ready} ready rows. Review any invalid rows below; duplicates will be skipped.</p><Button disabled={!!busy} onClick={() => check("import")}>{busy === "import" ? "Importing…" : `Import ${result.ready} application${result.ready === 1 ? "" : "s"}`}</Button></div>}
        <div className="space-y-1"><Label htmlFor="row-filter">Show rows</Label><select id="row-filter" className="h-9 rounded-md border bg-background px-2" value={filter} disabled={!!busy} onChange={(event) => {setFilter(event.target.value); setPage(0);}}><option value="all">All rows</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Line", "Company", "Job title", "Date applied", "Result", "Details"].map((label) => <th className="border-b p-2" key={label}>{label}</th>)}</tr></thead><tbody>{rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((row) => <tr key={row.line} className={row.status === "error" ? "text-destructive" : ""}><td className="p-2">{row.line}</td><td className="p-2">{row.company}</td><td className="p-2">{row.jobTitle}</td><td className="p-2">{row.applicationDate}</td><td className="p-2">{labels[row.status]}</td><td className="p-2">{row.reason}</td></tr>)}</tbody></table></div>
        {!rows.length && <p>No rows in this category.</p>}
        {rows.length > pageSize && <div className="flex items-center gap-3"><Button variant="outline" disabled={!currentPage || !!busy} onClick={() => setPage(currentPage - 1)}>Previous</Button><span>Page {currentPage + 1} of {Math.ceil(rows.length / pageSize)}</span><Button variant="outline" disabled={(currentPage + 1) * pageSize >= rows.length || !!busy} onClick={() => setPage(currentPage + 1)}>Next</Button></div>}
      </>}
    </Card>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
