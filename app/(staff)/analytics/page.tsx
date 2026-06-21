import { requireAdmin } from "@/lib/auth";
import { getFilteredAnalytics } from "@/lib/analytics";
import { getAdminLevels } from "@/lib/admin-scope";
import {
  TrendChart, BarsChart, DonutChart, HistogramChart,
  ScatterPlotChart, GaugeChart, BoxPlotChart, HeatmapChart,
} from "@/components/charts";
import { AnalyticsFilter } from "@/components/analytics-filter";

export const metadata = { title: "Analytics" };

type SP = Promise<{ year?: string; term?: string; class?: string; tab?: string }>;

const TABS = [
  { key: "overview",     label: "Overview" },
  { key: "performance",  label: "Performance" },
  { key: "attendance",   label: "Attendance" },
  { key: "demographics", label: "Demographics" },
  { key: "fees",         label: "Fees" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function SchoolAnalyticsPage({ searchParams }: { searchParams: SP }) {
  const session = await requireAdmin();
  const sp = await searchParams;
  const tab: TabKey = (sp.tab as TabKey) ?? "overview";

  const adminLevels = await getAdminLevels(session);
  const a = await getFilteredAnalytics({
    yearId:  sp.year,
    termId:  sp.term,
    classId: sp.class,
    adminLevels,
  });

  function tabHref(key: string) {
    const p = new URLSearchParams();
    if (a.selectedYear)  p.set("year",  a.selectedYear.id);
    if (a.selectedTerm)  p.set("term",  a.selectedTerm.id);
    if (a.selectedClass) p.set("class", a.selectedClass.id);
    p.set("tab", key);
    return `/analytics?${p.toString()}`;
  }

  const stats = [
    { label: "Active students", value: a.headline.students },
    { label: "Boys / Girls",    value: `${a.headline.boys} / ${a.headline.girls}` },
    { label: "Overall average", value: a.headline.overallAverage ?? "—" },
    { label: "Attendance rate", value: a.headline.attendancePct != null ? `${a.headline.attendancePct}%` : "—" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">{a.termLabel}</p>
      </div>

      {/* Filter bar */}
      <AnalyticsFilter
        years={a.years}
        terms={a.terms}
        classes={a.classes}
        selectedYearId={a.selectedYear?.id ?? null}
        selectedTermId={a.selectedTerm?.id ?? null}
        selectedClassId={a.selectedClass?.id ?? null}
        tab={tab}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <nav className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <a
            key={t.key}
            href={tabHref(t.key)}
            className={
              tab === t.key
                ? "border-b-2 border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700"
                : "px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            }
          >
            {t.label}
          </a>
        ))}
      </nav>

      {/* ── Overview ────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-gray-900">Score trend</h2>
            <TrendChart data={a.scoreTrend} series={[{ key: "Average", color: "#047857" }]} height={280} />
          </div>
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-gray-900">Attendance trend</h2>
            <TrendChart data={a.attendanceTrend} series={[{ key: "Attendance %", color: "#0369a1" }]} height={280} />
          </div>
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-gray-900">Average score by class</h2>
            <BarsChart data={a.classAverages} series={[{ key: "Average", color: "#047857" }]} height={280} />
          </div>
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-gray-900">Attendance rate by class</h2>
            <BarsChart data={a.attendanceByClass} series={[{ key: "Attendance %", color: "#0369a1" }]} height={280} />
          </div>
        </div>
      )}

      {/* ── Performance ─────────────────────────────────────── */}
      {tab === "performance" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-3 font-semibold text-gray-900">Average score by class</h2>
              <BarsChart data={a.classAverages} series={[{ key: "Average", color: "#047857" }]} height={300} />
            </div>
            <div className="card p-5">
              <h2 className="mb-3 font-semibold text-gray-900">Average score by subject</h2>
              <TrendChart data={a.subjectAverages} series={[{ key: "Average", color: "#7c3aed" }]} height={300} angleLabels />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-1 font-semibold text-gray-900">Score distribution</h2>
            <p className="mb-3 text-xs text-gray-500">How many students fall in each 10-point score band</p>
            <HistogramChart data={a.histogram} height={260} />
          </div>

          <div className="card p-5">
            <h2 className="mb-1 font-semibold text-gray-900">Score spread by class (box plot)</h2>
            <p className="mb-3 text-xs text-gray-500">
              Shows the median, interquartile range, and full spread of scores per class
            </p>
            <BoxPlotChart data={a.boxPlots} height={320} />
          </div>

          {a.teacherComparison.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-1 font-semibold text-gray-900">
                Subject assignments{a.selectedClass ? ` — ${a.selectedClass.name}` : ""}
              </h2>
              <p className="mb-3 text-xs text-gray-500">
                Average score per subject and assigned teacher.
                {!a.selectedClass && " Select a class above to narrow this down."}
              </p>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Teacher</th>
                      <th className="text-right">Scores on record</th>
                      <th className="text-right">Avg score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.teacherComparison.map((r, i) => (
                      <tr key={i}>
                        <td className="font-medium">{r.subject}</td>
                        <td>{r.teacher}</td>
                        <td className="text-right text-gray-500">{r.count}</td>
                        <td className="text-right font-semibold">
                          {r.avg != null ? r.avg : <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Attendance ──────────────────────────────────────── */}
      {tab === "attendance" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-1 font-semibold text-gray-900">Attendance rate</h2>
              <p className="mb-2 text-xs text-gray-500">Current rate vs 80% benchmark (blue marker)</p>
              <GaugeChart value={a.headline.attendancePct} target={80} height={170} />
            </div>
            <div className="card p-5">
              <h2 className="mb-3 font-semibold text-gray-900">Attendance rate by class</h2>
              <BarsChart data={a.attendanceByClass} series={[{ key: "Attendance %", color: "#0369a1" }]} height={220} />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-gray-900">Attendance trend (across terms)</h2>
            <TrendChart data={a.attendanceTrend} series={[{ key: "Attendance %", color: "#0369a1" }]} height={260} />
          </div>

          {a.heatmap.length > 0 ? (
            <div className="card p-5">
              <h2 className="mb-1 font-semibold text-gray-900">Daily attendance heatmap</h2>
              <p className="mb-3 text-xs text-gray-500">
                Rate per day of the week across each week of the term. Green = high attendance, red = low.
              </p>
              <HeatmapChart data={a.heatmap} height={148} />
            </div>
          ) : (
            <div className="card p-5">
              <p className="text-sm text-gray-500">
                {a.selectedTerm
                  ? "No daily attendance records found for this term."
                  : "Select a specific term above to see the daily attendance heatmap."}
              </p>
            </div>
          )}

          <div className="card p-5">
            <h2 className="mb-1 font-semibold text-gray-900">
              Attendance vs score{a.selectedClass ? ` — ${a.selectedClass.name}` : ""}
            </h2>
            <p className="mb-3 text-xs text-gray-500">
              {a.selectedClass
                ? "Each dot is a student. Higher attendance generally correlates with higher scores."
                : "Select a class above to see per-student attendance vs score scatter plot."}
            </p>
            <ScatterPlotChart data={a.scatter} height={300} />
          </div>
        </div>
      )}

      {/* ── Demographics ────────────────────────────────────── */}
      {tab === "demographics" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-gray-900">Gender split (active students)</h2>
            <DonutChart data={a.genderSplit} height={280} />
          </div>
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-gray-900">Enrollment by class</h2>
            <BarsChart
              data={a.enrollment}
              series={[
                { key: "Boys",  color: "#0369a1" },
                { key: "Girls", color: "#be123c" },
              ]}
              stacked
              yMax="auto"
              height={280}
            />
          </div>
        </div>
      )}

      {/* ── Fees ────────────────────────────────────────────── */}
      {tab === "fees" && (
        <div className="space-y-6">
          {a.feesByTerm.length > 0 ? (
            <div className="card p-5">
              <h2 className="mb-3 font-semibold text-gray-900">
                Fees — expected vs collected (GH₵)
              </h2>
              <BarsChart
                data={a.feesByTerm}
                series={[
                  { key: "Expected",  color: "#94a3b8" },
                  { key: "Collected", color: "#047857" },
                ]}
                yMax="auto"
                height={320}
              />
            </div>
          ) : (
            <div className="card p-5">
              <p className="text-sm text-gray-500">No fee data for the selected period.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
