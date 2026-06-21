"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { SaveScoresState } from "@/app/(staff)/scores/actions";
import DraftBanner from "./draft-banner";
import Icon from "./icon";

export type ScoreRowData = {
  studentId: string;
  name: string;
  cw1: number | null;
  cw2: number | null;
  cw3: number | null;
  cw4: number | null;
  examScore: number | null;
  recordedBy: string | null;
  lastSaved: string | null;
};

type Band = { min: number; grade: string; remark: string };
type Cells = { cw1: string; cw2: string; cw3: string; cw4: string; es: string };

const CLASSWORK_MAX = 60;
const r1 = (n: number) => Math.round(n * 10) / 10;
const numOrNull = (s: string) => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return isNaN(n) ? null : n;
};

function toCells(r: ScoreRowData): Cells {
  const s = (v: number | null) => (v == null ? "" : String(v));
  return { cw1: s(r.cw1), cw2: s(r.cw2), cw3: s(r.cw3), cw4: s(r.cw4), es: s(r.examScore) };
}

function compute(c: Cells, bands: Band[]) {
  const cws = [c.cw1, c.cw2, c.cw3, c.cw4].map(numOrNull).filter((v): v is number => v != null);
  const cwTotal = cws.length ? r1(cws.reduce((a, b) => a + b, 0)) : null;
  const exam = numOrNull(c.es);
  const over = cwTotal != null && cwTotal > CLASSWORK_MAX;
  const examOver = exam != null && exam > 100;
  const invalid = over || examOver;
  const class50 = cwTotal != null ? r1((cwTotal / CLASSWORK_MAX) * 50) : null;
  const exam50 = exam != null ? r1(exam / 2) : null;
  const final =
    class50 == null && exam50 == null ? null : r1((class50 ?? 0) + (exam50 ?? 0));
  let grade = "—";
  let remark = "—";
  if (final != null && !invalid) {
    const band = bands.find((b) => final >= b.min) ?? bands[bands.length - 1];
    if (band) {
      grade = band.grade;
      remark = band.remark;
    }
  }
  return { cwTotal, class50, exam50, final, over, examOver, invalid, grade, remark };
}

export default function ScoreEntryTable({
  action,
  rows,
  bands,
  draftKey,
}: {
  action: (state: SaveScoresState, formData: FormData) => Promise<SaveScoresState>;
  rows: ScoreRowData[];
  bands: Band[];
  draftKey: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const overrideRef = useRef<HTMLInputElement>(null);

  const initial = useMemo(() => {
    const m: Record<string, Cells> = {};
    for (const r of rows) m[r.studentId] = toCells(r);
    return m;
  }, [rows]);

  const [values, setValues] = useState<Record<string, Cells>>(initial);
  const [pendingDraft, setPendingDraft] = useState<Record<string, Cells> | null>(null);

  // Look for a device draft saved during an earlier (interrupted) session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(draftKey);
    } catch {
      return;
    }
    if (!raw) return;
    if (raw === JSON.stringify(initial)) {
      localStorage.removeItem(draftKey);
    } else {
      try {
        setPendingDraft(JSON.parse(raw));
      } catch {
        localStorage.removeItem(draftKey);
      }
    }
  }, [draftKey, initial]);

  // Autosave the current entries to the device (debounced), so a dropped
  // connection or closed tab never loses them.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        if (JSON.stringify(values) === JSON.stringify(initial)) localStorage.removeItem(draftKey);
        else localStorage.setItem(draftKey, JSON.stringify(values));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [values, initial, draftKey]);

  // Clear the draft once a save succeeds.
  useEffect(() => {
    if (state?.ok) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    }
  }, [state, draftKey]);

  const setCell = (id: string, field: keyof Cells, value: string) =>
    setValues((v) => ({ ...v, [id]: { ...v[id], [field]: value } }));

  const submitReplace = () => {
    if (overrideRef.current) overrideRef.current.value = "1";
    formRef.current?.requestSubmit();
  };
  const submitNormal = () => {
    if (overrideRef.current) overrideRef.current.value = "";
  };

  const anyInvalid = rows.some((r) => compute(values[r.studentId], bands).invalid);

  return (
    <div className="space-y-3">
      {pendingDraft && (
        <DraftBanner
          onRestore={() => {
            setValues(pendingDraft);
            setPendingDraft(null);
          }}
          onDiscard={() => {
            try {
              localStorage.removeItem(draftKey);
            } catch {
              /* ignore */
            }
            setPendingDraft(null);
          }}
        />
      )}

      <form ref={formRef} action={formAction} className="card overflow-x-auto">
        <input type="hidden" name="loadedAt" defaultValue={new Date().toISOString()} />
        <input ref={overrideRef} type="hidden" name="override" defaultValue="" />

        {state && (
          <div
            className={`border-b px-4 py-3 text-sm ${
              state.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <p className="font-medium">{state.message}</p>
            {state.conflicts && state.conflicts.length > 0 && (
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                {state.conflicts.map((c, i) => (
                  <li key={i}>
                    <span className="font-semibold">{c.pupil}</span> — changed by{" "}
                    <span className="font-semibold">{c.by}</span> on {c.when}. In the system now:{" "}
                    {c.theirs}; yours: {c.yours}.
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <table className="tbl min-w-[60rem]">
          <thead>
            <tr>
              <th>#</th>
              <th>Student</th>
              <th className="text-center">CW1</th>
              <th className="text-center">CW2</th>
              <th className="text-center">CW3</th>
              <th className="text-center">CW4</th>
              <th className="text-center">Total /60</th>
              <th className="text-center">Class 50%</th>
              <th className="text-center">Exam /100</th>
              <th className="text-center">Exam 50%</th>
              <th className="text-center">Final 100%</th>
              <th className="text-center">Grade</th>
              <th>Remark</th>
              <th>Last saved</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const c = values[row.studentId];
              const d = compute(c, bands);
              const cwInput = (field: "cw1" | "cw2" | "cw3" | "cw4") => (
                <input
                  type="number"
                  inputMode="decimal"
                  name={`${field}_${row.studentId}`}
                  min={0}
                  max={CLASSWORK_MAX}
                  step="any"
                  value={c[field]}
                  onChange={(e) => setCell(row.studentId, field, e.target.value)}
                  className="input w-16 px-2 py-1 text-center"
                  aria-label={`${row.name} ${field.toUpperCase()}`}
                />
              );
              return (
                <tr key={row.studentId}>
                  <td>{i + 1}</td>
                  <td className="font-medium whitespace-nowrap">{row.name}</td>
                  <td className="text-center">{cwInput("cw1")}</td>
                  <td className="text-center">{cwInput("cw2")}</td>
                  <td className="text-center">{cwInput("cw3")}</td>
                  <td className="text-center">{cwInput("cw4")}</td>
                  <td
                    className={`text-center font-semibold ${d.over ? "bg-red-100 text-red-700" : ""}`}
                    title={d.over ? `Above ${CLASSWORK_MAX} — please correct` : undefined}
                  >
                    {d.cwTotal ?? "—"}
                    {d.over ? <Icon name="warning" className="ml-1" /> : null}
                  </td>
                  <td className="text-center">{d.class50 ?? "—"}</td>
                  <td
                    className={`text-center ${d.examOver ? "bg-red-100" : ""}`}
                    title={d.examOver ? "Exam score is above 100 — please correct" : undefined}
                  >
                    <input
                      type="number"
                      inputMode="decimal"
                      name={`es_${row.studentId}`}
                      min={0}
                      max={100}
                      step="any"
                      value={c.es}
                      onChange={(e) => setCell(row.studentId, "es", e.target.value)}
                      className={`input w-16 px-2 py-1 text-center ${
                        d.examOver ? "border-red-400 text-red-700" : ""
                      }`}
                      aria-label={`${row.name} exam score`}
                    />
                    {d.examOver ? <Icon name="warning" className="ml-1 text-red-700" /> : null}
                  </td>
                  <td className="text-center">{d.exam50 ?? "—"}</td>
                  <td className="text-center font-semibold">{d.invalid ? "—" : (d.final ?? "—")}</td>
                  <td className="text-center">{d.grade}</td>
                  <td className="whitespace-nowrap">{d.remark}</td>
                  <td className="text-xs whitespace-nowrap text-gray-500">
                    {row.lastSaved ? `${row.recordedBy ?? "—"} · ${row.lastSaved}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 p-4">
          <p className="text-xs text-gray-500">
            Class works total out of {CLASSWORK_MAX} (flagged red if exceeded) and convert to 50%;
            the exam out of 100 converts to 50%. Entries are kept on this device until saved.
          </p>
          {state?.needsConfirm ? (
            <div className="flex flex-wrap gap-2">
              <a href="" className="btn-secondary">
                Keep the newer data (reload)
              </a>
              <button
                type="submit"
                onClick={submitReplace}
                disabled={pending}
                className="btn-danger"
                title="Overwrites the values listed above with what you typed"
              >
                {pending ? "Saving…" : "Replace newer data with mine"}
              </button>
            </div>
          ) : (
            <button type="submit" onClick={submitNormal} disabled={pending || anyInvalid} className="btn-primary">
              {pending ? "Saving…" : anyInvalid ? "Fix flagged scores to save" : "Save all scores"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
