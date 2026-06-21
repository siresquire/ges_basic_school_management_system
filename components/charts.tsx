"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";

export const CHART_COLORS = [
  "#047857", // emerald
  "#d97706", // amber
  "#0369a1", // sky
  "#be123c", // rose
  "#7c3aed", // violet
  "#0f766e", // teal
  "#b45309", // orange
  "#1d4ed8", // blue
  "#a21caf", // fuchsia
  "#4d7c0f", // lime
  "#dc2626", // red
  "#0891b2", // cyan
];

export type ChartSeries = { key: string; name?: string; color?: string };

type Row = Record<string, string | number | null>;

function yDomain(yMax?: number | "auto"): [number, number | "auto"] {
  return [0, yMax === "auto" ? "auto" : (yMax ?? 100)];
}

/** Multi-series line chart; rows need a `label` field. */
export function TrendChart({
  data,
  series,
  yMax,
  height = 288,
  angleLabels = false,
}: {
  data: Row[];
  series: ChartSeries[];
  yMax?: number | "auto";
  height?: number;
  /** Slant x-axis labels — for long names like subjects. */
  angleLabels?: boolean;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          {angleLabels ? (
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={70}
            />
          ) : (
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          )}
          <YAxis domain={yDomain(yMax)} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name ?? s.key}
              stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export type BoxPoint = {
  label: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  avg: number | null;
};

export type HeatCell = { week: number; day: number; pct: number | null };
export type ScatterPoint = { x: number; y: number; name: string };

/** Multi-series bar chart; rows need a `label` field. */
export function BarsChart({
  data,
  series,
  stacked = false,
  yMax,
  height = 288,
}: {
  data: Row[];
  series: ChartSeries[];
  stacked?: boolean;
  yMax?: number | "auto";
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={70} />
          <YAxis domain={yDomain(yMax)} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend verticalAlign="top" />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name ?? s.key}
              fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              stackId={stacked ? "stack" : undefined}
              radius={stacked ? undefined : [3, 3, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut (pie with hole) chart — data needs `label` and `value` fields. */
export function DonutChart({
  data,
  height = 240,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <p className="py-8 text-center text-sm text-gray-400">No data</p>;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius="52%" outerRadius="76%" paddingAngle={3}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => [`${v} (${Math.round((Number(v) / total) * 100)}%)`, ""]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Histogram — bars with no gap, for score distribution. */
export function HistogramChart({
  data,
  height = 240,
}: {
  data: { label: string; count: number }[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }} barCategoryGap={0}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" name="Students" fill="#7c3aed" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Scatter plot — x = attendance %, y = avg score, each point is a student. */
export function ScatterPlotChart({
  data,
  height = 288,
}: {
  data: ScatterPoint[];
  height?: number;
}) {
  if (!data.length)
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        Select a class with both score and attendance records to see this chart.
      </p>
    );
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 32 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            dataKey="x"
            name="Attendance %"
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            label={{ value: "Attendance %", position: "insideBottom", offset: -20, fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Avg score"
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            label={{ value: "Avg score", angle: -90, position: "insideLeft", offset: 12, fontSize: 12 }}
          />
          <ZAxis range={[40, 40]} />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload as ScatterPoint;
              return (
                <div className="rounded border border-gray-200 bg-white px-2 py-1 text-xs shadow">
                  <p className="font-medium">{d.name}</p>
                  <p>Attendance: {d.x}%</p>
                  <p>Avg score: {d.y}</p>
                </div>
              );
            }}
          />
          <Scatter data={data} fill="#0369a1" fillOpacity={0.7} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Gauge chart — SVG arc showing a percentage vs a target. */
export function GaugeChart({
  value,
  target = 80,
  height = 170,
}: {
  value: number | null;
  target?: number;
  height?: number;
}) {
  if (value == null)
    return <p className="py-8 text-center text-sm text-gray-400">No attendance data</p>;

  const R = 78;
  const cx = 110;
  const cy = 96;

  function arc(fromAngle: number, toAngle: number, r: number) {
    const x1 = cx + r * Math.cos(fromAngle);
    const y1 = cy + r * Math.sin(fromAngle);
    const x2 = cx + r * Math.cos(toAngle);
    const y2 = cy + r * Math.sin(toAngle);
    const large = Math.abs(toAngle - fromAngle) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  const valueAngle = Math.PI - (value / 100) * Math.PI;
  const targetAngle = Math.PI - (target / 100) * Math.PI;
  const color = value >= target ? "#047857" : value >= target * 0.8 ? "#d97706" : "#dc2626";

  return (
    <svg viewBox="0 0 220 116" style={{ height }} className="w-full">
      <path d={arc(Math.PI, 0, R)} fill="none" stroke="#e5e7eb" strokeWidth={15} strokeLinecap="round" />
      <path d={arc(Math.PI, valueAngle, R)} fill="none" stroke={color} strokeWidth={15} strokeLinecap="round" />
      <line
        x1={cx + (R - 11) * Math.cos(targetAngle)}
        y1={cy + (R - 11) * Math.sin(targetAngle)}
        x2={cx + (R + 11) * Math.cos(targetAngle)}
        y2={cy + (R + 11) * Math.sin(targetAngle)}
        stroke="#1d4ed8"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={30} fontWeight="bold" fill={color}>
        {value}%
      </text>
      <text x={cx} y={cy + 17} textAnchor="middle" fontSize={11} fill="#6b7280">
        Target: {target}%
      </text>
      <text x={28} y={cy + 16} textAnchor="middle" fontSize={10} fill="#9ca3af">0%</text>
      <text x={192} y={cy + 16} textAnchor="middle" fontSize={10} fill="#9ca3af">100%</text>
    </svg>
  );
}

/** Box-and-whisker plot — min/Q1/median/Q3/max per class. Pure SVG. */
export function BoxPlotChart({
  data,
  height = 300,
}: {
  data: BoxPoint[];
  height?: number;
}) {
  if (!data.length)
    return <p className="py-8 text-center text-sm text-gray-400">Not enough data for distribution</p>;

  const mt = 16, mr = 8, mb = 48, ml = 36;
  const cols = data.length;
  const svgW = Math.max(420, cols * 72);
  const svgH = height;
  const plotH = svgH - mt - mb;
  const plotW = svgW - ml - mr;
  const toY = (v: number) => mt + (1 - v / 100) * plotH;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: svgH }}>
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = toY(tick);
          return (
            <g key={tick}>
              <line x1={ml} y1={y} x2={svgW - mr} y2={y} stroke="#e5e7eb" strokeDasharray={tick === 0 || tick === 100 ? undefined : "3 3"} />
              <text x={ml - 5} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{tick}</text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const colW = plotW / cols;
          const cx = ml + colW * i + colW / 2;
          const bw = Math.min(38, colW * 0.52);
          const yMin = toY(d.min);
          const yQ1 = toY(d.q1);
          const yMed = toY(d.median);
          const yQ3 = toY(d.q3);
          const yMax = toY(d.max);
          const yAvg = d.avg != null ? toY(d.avg) : null;
          const capW = bw * 0.42;

          return (
            <g key={d.label}>
              {/* Lower whisker */}
              <line x1={cx} y1={yQ1} x2={cx} y2={yMin} stroke="#6b7280" strokeWidth={1.5} />
              <line x1={cx - capW} y1={yMin} x2={cx + capW} y2={yMin} stroke="#6b7280" strokeWidth={1.5} />
              {/* IQR box */}
              <rect x={cx - bw / 2} y={yQ3} width={bw} height={yQ1 - yQ3} fill="#d1fae5" stroke="#047857" strokeWidth={1.5} rx={2} />
              {/* Median */}
              <line x1={cx - bw / 2} y1={yMed} x2={cx + bw / 2} y2={yMed} stroke="#047857" strokeWidth={2.5} />
              {/* Upper whisker */}
              <line x1={cx} y1={yQ3} x2={cx} y2={yMax} stroke="#6b7280" strokeWidth={1.5} />
              <line x1={cx - capW} y1={yMax} x2={cx + capW} y2={yMax} stroke="#6b7280" strokeWidth={1.5} />
              {/* Mean dot */}
              {yAvg != null && <circle cx={cx} cy={yAvg} r={3.5} fill="#be123c" stroke="white" strokeWidth={1.5} />}
              {/* Label */}
              <text
                x={cx}
                y={svgH - mb + 14}
                textAnchor="middle"
                fontSize={cols > 8 ? 8 : 10}
                fill="#374151"
                transform={cols > 6 ? `rotate(-28 ${cx} ${svgH - mb + 14})` : undefined}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center text-xs text-gray-400">
        Box = IQR (Q1–Q3) &nbsp;·&nbsp; Line = median &nbsp;·&nbsp; <span style={{ color: "#be123c" }}>●</span> = mean &nbsp;·&nbsp; Whiskers = min/max
      </p>
    </div>
  );
}

const HEATMAP_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function heatColor(pct: number | null): string {
  if (pct == null) return "#f3f4f6";
  if (pct >= 90) return "#047857";
  if (pct >= 75) return "#34d399";
  if (pct >= 60) return "#fbbf24";
  if (pct >= 40) return "#f97316";
  return "#dc2626";
}

/** Attendance heatmap — day-of-week (rows) × week-of-term (columns). */
export function HeatmapChart({ data, height = 148 }: { data: HeatCell[]; height?: number }) {
  if (!data.length)
    return <p className="py-6 text-center text-sm text-gray-400">No daily attendance records for this term</p>;

  const weeks = Math.max(...data.map((d) => d.week)) + 1;
  const cs = 18, g = 3, lp = 28, tp = 4;
  const svgW = lp + weeks * (cs + g);
  const svgH = tp + 5 * (cs + g) + 14;
  const cellMap = new Map(data.map((d) => [`${d.week}:${d.day}`, d]));

  return (
    <div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ height, minWidth: Math.min(svgW, 560) }} className="w-full">
          {HEATMAP_DAYS.map((day, di) => (
            <text key={day} x={lp - 4} y={tp + di * (cs + g) + cs * 0.72} textAnchor="end" fontSize={9} fill="#6b7280">
              {day}
            </text>
          ))}
          {Array.from({ length: weeks }, (_, wi) =>
            Array.from({ length: 5 }, (_, di) => {
              const cell = cellMap.get(`${wi}:${di}`);
              const x = lp + wi * (cs + g);
              const y = tp + di * (cs + g);
              return (
                <rect key={`${wi}:${di}`} x={x} y={y} width={cs} height={cs} fill={heatColor(cell?.pct ?? null)} rx={2}>
                  {cell?.pct != null && <title>Week {wi + 1}, {HEATMAP_DAYS[di]}: {cell.pct}%</title>}
                </rect>
              );
            })
          )}
          {Array.from({ length: weeks }, (_, wi) => (
            <text key={wi} x={lp + wi * (cs + g) + cs / 2} y={svgH - 1} textAnchor="middle" fontSize={8} fill="#9ca3af">
              W{wi + 1}
            </text>
          ))}
        </svg>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
        <span>Low</span>
        {["#dc2626", "#f97316", "#fbbf24", "#34d399", "#047857"].map((c) => (
          <span key={c} style={{ background: c, width: 11, height: 11, borderRadius: 2, display: "inline-block" }} />
        ))}
        <span>High</span>
      </div>
    </div>
  );
}
