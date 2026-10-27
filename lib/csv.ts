export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_CSV_ROWS = 500;
export const EXPORT_FORMAT = "interviews.tools/v1-tab";
export type CSVRecord = {line: number; cells: string[]};
export type CSVTable = {headers: string[]; records: CSVRecord[]};

export function parseCSV(input: string): CSVTable {
  if (new TextEncoder().encode(input).length > MAX_CSV_BYTES) throw new Error("The CSV must be no larger than 2 MB.");
  const text = input.replace(/^\uFEFF/, "");
  const records: CSVRecord[] = [];
  let cells: string[] = [], value = "", quoted = false, closed = false, started = false;
  let line = 1, start = 1;
  const field = () => {cells.push(value); value = ""; closed = false; if (cells.length > 100) throw new Error(`Line ${start}: no more than 100 columns are supported.`);};
  const record = () => {
    if (started) {field(); records.push({line: start, cells});}
    cells = []; started = false;
    if (records.length > MAX_CSV_ROWS + 1) throw new Error(`Import at most ${MAX_CSV_ROWS} data rows per file.`);
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {value += '"'; i++;} else {quoted = false; closed = true;}
      } else {value += char; if (char === "\n" || (char === "\r" && text[i + 1] !== "\n")) line++;}
      continue;
    }
    if (char === ",") {started = true; field();}
    else if (char === "\n" || char === "\r") {
      record(); if (char === "\r" && text[i + 1] === "\n") i++;
      line++; start = line;
    } else if (char === '"') {
      if (value || closed) throw new Error(`Line ${line}: unexpected quote. Put the entire field in quotes and double any quotes inside it.`);
      quoted = true; started = true;
    } else {
      if (closed) throw new Error(`Line ${line}: unexpected text after a closing quote.`);
      started = true; value += char;
    }
  }
  if (quoted) throw new Error(`Line ${start}: a quoted field was not closed.`);
  record();
  if (!records.length) throw new Error("The file is empty. Include a header row and your applications.");
  const [header, ...data] = records;
  if (!data.length) throw new Error("The file has no application rows.");
  return {headers: header.cells, records: data};
}

// Keep formula-leading cells as text in spreadsheet downloads. The version marker
// lets our own importer remove this one added tab without changing the original value.
// See https://community.owasp.org/attacks/CSV_Injection for spreadsheet trade-offs.
const needsGuard = (text: string) => /^[\t\r\n]/.test(text) || /^\s*[=+\-@＝＋－＠]/u.test(text);
export function spreadsheetText(text: string): string {return needsGuard(text) ? `\t${text}` : text;}
export function restoreExportText(text: string): string {return text.startsWith("\t") && needsGuard(text.slice(1)) ? text.slice(1) : text;}
export function writeCSV(rows: (string | number | Date | null | undefined)[][], guard = false): string {
  return "\uFEFF" + rows.map((row) => row.map((value) => {
    const text = value instanceof Date ? value.toISOString() : String(value ?? "");
    return `"${(guard ? spreadsheetText(text) : text).replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n") + "\r\n";
}
