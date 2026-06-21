"use client";

import { useRouter } from "next/navigation";

type Props = {
  years: { id: string; name: string }[];
  terms: { id: string; name: string; yearId: string }[];
  classes: { id: string; name: string }[];
  selectedYearId: string | null;
  selectedTermId: string | null;
  selectedClassId: string | null;
  tab: string;
};

export function AnalyticsFilter({
  years, terms, classes,
  selectedYearId, selectedTermId, selectedClassId, tab,
}: Props) {
  const router = useRouter();

  function go(changes: Record<string, string | null>) {
    const p = new URLSearchParams();
    const vals: Record<string, string | null> = {
      year: selectedYearId,
      term: selectedTermId,
      class: selectedClassId,
      tab: tab || null,
      ...changes,
    };
    for (const [k, v] of Object.entries(vals)) {
      if (v) p.set(k, v);
    }
    router.push(`/analytics?${p.toString()}`);
  }

  const termsForYear = selectedYearId
    ? terms.filter((t) => t.yearId === selectedYearId)
    : terms;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label">Academic year</label>
        <select
          className="input py-1.5 text-sm"
          value={selectedYearId ?? ""}
          onChange={(e) => go({ year: e.target.value || null, term: null })}
        >
          {years.map((y) => (
            <option key={y.id} value={y.id}>{y.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Term</label>
        <select
          className="input py-1.5 text-sm"
          value={selectedTermId ?? ""}
          onChange={(e) => go({ term: e.target.value || null })}
        >
          <option value="">All terms</option>
          {termsForYear.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Class</label>
        <select
          className="input py-1.5 text-sm"
          value={selectedClassId ?? ""}
          onChange={(e) => go({ class: e.target.value || null })}
        >
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
