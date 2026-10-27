export type QuestionEntry = {
  interviewId: number;
  company: string;
  recruiter: string | null;
  stage: string;
  date: string;
  jobTitle: string;
  questions: string[];
  notes: string | null;
};

export type QuestionSource = {
  id: number; date: Date | null; debriefedAt: Date | null; created_at: Date;
  questionsAsked: string | null; debriefNotes: string | null;
  stage: {stage: string};
  application: {jobTitle: string; clientCompany: string | null; company: {name: string}};
};

export function questionEntries(rows: QuestionSource[]): QuestionEntry[] {
  return rows.flatMap((row) => {
    const questions = (row.questionsAsked ?? "").split(/\r?\n/).map((q) => q.trim()).filter(Boolean);
    if (!questions.length) return [];
    const client = row.application.clientCompany?.trim();
    return [{interviewId: row.id, company: client || row.application.company.name,
      recruiter: client ? row.application.company.name : null, stage: row.stage.stage,
      date: (row.date ?? row.debriefedAt ?? row.created_at).toISOString(),
      jobTitle: row.application.jobTitle, questions, notes: row.debriefNotes}];
  }).sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || b.interviewId - a.interviewId);
}

const normalize = (text: string) => text.trim().toLowerCase();

export function filterQuestions(entries: QuestionEntry[], {q = "", company = "", stage = ""}: {q?: string; company?: string; stage?: string}): QuestionEntry[] {
  const search = normalize(q);
  return entries.filter((entry) => (!company || normalize(entry.company) === normalize(company))
    && (!stage || normalize(entry.stage) === normalize(stage))
    && (!search || [entry.company, entry.recruiter, entry.stage, entry.jobTitle, entry.notes, ...entry.questions]
      .some((text) => normalize(text ?? "").includes(search))));
}

export function previousQuestions(entries: QuestionEntry[], current: {interviewId: number; company: string; stage: string; date: string}): QuestionEntry[] {
  return filterQuestions(entries, current).filter((entry) => entry.interviewId !== current.interviewId && Date.parse(entry.date) < Date.parse(current.date));
}
