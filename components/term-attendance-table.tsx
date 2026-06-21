"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DraftBanner from "./draft-banner";
import Icon from "./icon";

export type TermAttendanceRow = {
  studentId: string;
  name: string;
  daysPresent: number | null;
  recordedBy: string | null;
  lastSaved: string | null;
};

type Draft = { total: string; present: Record<string, string> };

export default function TermAttendanceTable({
  action,
  rows,
  initialTotal,
  draftKey,
}: {
  action: (formData: FormData) => void | Promise<void>;
  rows: TermAttendanceRow[];
  initialTotal: number | null;
  draftKey: string;
}) {
  const initial = useMemo<Draft>(
    () => ({
      total: initialTotal == null ? "" : String(initialTotal),
      present: Object.fromEntries(
        rows.map((r) => [r.studentId, r.daysPresent == null ? "" : String(r.daysPresent)])
      ),
    }),
    [rows, initialTotal]
  );

  const [total, setTotal] = useState(initial.total);
  const [present, setPresent] = useState<Record<string, string>>(initial.present);
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);

  const current = useMemo<Draft>(() => ({ total, present }), [total, present]);

  // Detect a saved device draft from an interrupted session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(draftKey);
    } catch {
      return;
    }
    if (!raw) return;
    if (raw === JSON.stringify(initial)) localStorage.removeItem(draftKey);
    else {
      try {
        setPendingDraft(JSON.parse(raw));
      } catch {
        localStorage.removeItem(draftKey);
      }
    }
  }, [draftKey, initial]);

  // Autosave (debounced).
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        if (JSON.stringify(current) === JSON.stringify(initial)) localStorage.removeItem(draftKey);
        else localStorage.setItem(draftKey, JSON.stringify(current));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [current, initial, draftKey]);

  const totalNum = total.trim() === "" ? null : Number(total);

  return (
    <div className="space-y-3">
      {pendingDraft && (
        <DraftBanner
          onRestore={() => {
            setTotal(pendingDraft.total);
            setPresent(pendingDraft.present);
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

      <form action={action} className="card overflow-x-auto">
        <div className="flex flex-wrap items-end gap-3 border-b border-gray-200 p-4">
          <div>
            <label className="label">Total school days this term</label>
            <input
              type="number"
              name="daysTotal"
              min={0}
              max={120}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className="input w-40"
              placeholder="e.g. 62"
            />
          </div>
          <p className="pb-2 text-xs text-gray-500">
            Enter each pupil&apos;s days present from the register; days absent and the percentage
            are worked out automatically.
          </p>
        </div>

        <table className="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>Student</th>
              <th className="text-center">Days present</th>
              <th className="text-center">Days absent</th>
              <th className="text-center">Attendance %</th>
              <th>Last saved</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const p = present[row.studentId] ?? "";
              const pNum = p.trim() === "" ? null : Number(p);
              const absent =
                totalNum != null && pNum != null ? Math.max(0, totalNum - pNum) : null;
              const pct =
                totalNum != null && totalNum > 0 && pNum != null
                  ? Math.round((pNum / totalNum) * 1000) / 10
                  : null;
              const over = totalNum != null && pNum != null && pNum > totalNum;
              return (
                <tr key={row.studentId}>
                  <td>{i + 1}</td>
                  <td className="font-medium whitespace-nowrap">{row.name}</td>
                  <td className="text-center">
                    <input
                      type="number"
                      inputMode="numeric"
                      name={`present_${row.studentId}`}
                      min={0}
                      max={totalNum ?? 120}
                      step="1"
                      value={p}
                      onChange={(e) =>
                        setPresent((cur) => ({ ...cur, [row.studentId]: e.target.value }))
                      }
                      className={`input w-20 px-2 py-1 text-center ${over ? "border-red-400 text-red-700" : ""}`}
                      aria-label={`${row.name} days present`}
                    />
                    {over ? <Icon name="warning" className="ml-1 text-red-700" /> : null}
                  </td>
                  <td className="text-center">{over ? "—" : (absent ?? "—")}</td>
                  <td className="text-center">{over ? "—" : pct != null ? `${pct}%` : "—"}</td>
                  <td className="text-xs whitespace-nowrap text-gray-500">
                    {row.lastSaved ? `${row.recordedBy ?? "—"} · ${row.lastSaved}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 p-4">
          <p className="text-xs text-gray-500">Entries are kept on this device until saved.</p>
          <button className="btn-primary">Save attendance totals</button>
        </div>
      </form>
    </div>
  );
}
