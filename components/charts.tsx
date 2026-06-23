"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

export const CHART_COLORS = [
  "#047857", // emerald
  "#0369a1", // sky
  "#d97706", // amber
  "#7c3aed", // violet
  "#be123c", // rose
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

function buildConfig(series: ChartSeries[]): ChartConfig {
  return Object.fromEntries(
    series.map((s, i) => [
      s.key,
      { label: s.name ?? s.key, color: s.color ?? CHART_COLORS[i % CHART_COLORS.length] },
    ])
  );
}

function yDomain(yMax?: number | "auto"): [number, number | "auto"] {
  return [0, yMax === "auto" ? "auto" : (yMax ?? 100)];
}

/** Multi-series line chart */
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
  angleLabels?: boolean;
}) {
  const config = buildConfig(series);
  return (
    <ChartContainer config={config} style={{ height }} className="w-full">
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: angleLabels ? 8 : 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          {...(angleLabels ? { angle: -25, textAnchor: "end", height: 60, interval: 0 } : {})}
        />
        <YAxis domain={yDomain(yMax)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

/** Multi-series bar chart */
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
  const config = buildConfig(series);
  return (
    <ChartContainer config={config} style={{ height }} className="w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          angle={-25}
          textAnchor="end"
          height={60}
          interval={0}
        />
        <YAxis domain={yDomain(yMax)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent verticalAlign="top" />} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            stackId={stacked ? "stack" : undefined}
            radius={stacked ? undefined : [3, 3, 0, 0]}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

/** Donut chart */
export function DonutChart({
  data,
  height = 240,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <p className="py-8 text-center text-sm text-gray-400">No data</p>;

  const config: ChartConfig = Object.fromEntries(
    data.map((d, i) => [
      d.label,
      { label: d.label, color: CHART_COLORS[i % CHART_COLORS.length] },
    ])
  );

  return (
    <ChartContainer config={config} style={{ height }} className="w-full">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius="50%"
          outerRadius="74%"
          paddingAngle={3}
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => {
                const pct = Math.round((Number(value) / total) * 100);
                return (
                  <span className="font-mono font-medium">
                    {value} <span className="text-gray-400">({pct}%)</span>
                  </span>
                );
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
      </PieChart>
    </ChartContainer>
  );
}

/** Score distribution histogram */
export function HistogramChart({
  data,
  height = 240,
}: {
  data: { label: string; count: number }[];
  height?: number;
}) {
  const config: ChartConfig = { count: { label: "Students", color: "#7c3aed" } };
  return (
    <ChartContainer config={config} style={{ height }} className="w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 8 }} barCategoryGap={1}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" fill="#7c3aed" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

/** Scatter plot — attendance % (x) vs avg score (y) */
export type ScatterPoint = { x: number; y: number; name: string };

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

  const config: ChartConfig = { students: { label: "Students", color: "#0369a1" } };

  return (
    <ChartContainer config={config} style={{ height }} className="w-full">
      <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 32 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="x"
          name="Attendance %"
          domain={[0, 100]}
          tick={{ fontSize: 11 }}
          tickLine={false}
          label={{ value: "Attendance %", position: "insideBottom", offset: -20, fontSize: 12 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Avg score"
          domain={[0, 100]}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          label={{ value: "Avg score", angle: -90, position: "insideLeft", offset: 12, fontSize: 12 }}
        />
        <ZAxis range={[40, 40]} />
        <ChartTooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ payload }) => {
            if (!payload?.length) return null;
            const d = payload[0].payload as ScatterPoint;
            return (
              <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-xl">
                <p className="mb-1 font-medium text-gray-900">{d.name}</p>
                <p className="text-gray-500">Attendance: <span className="font-mono font-medium text-gray-900">{d.x}%</span></p>
                <p className="text-gray-500">Avg score: <span className="font-mono font-medium text-gray-900">{d.y}</span></p>
              </div>
            );
          }}
        />
        <Scatter data={data} fill="#0369a1" fillOpacity={0.7} />
      </ScatterChart>
    </ChartContainer>
  );
}

/** Gauge chart — SVG arc */
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

  const R = 78, cx = 110, cy = 96;
  const arc = (from: number, to: number, r: number) => {
    const x1 = cx + r * Math.cos(from), y1 = cy + r * Math.sin(from);
    const x2 = cx + r * Math.cos(to), y2 = cy + r * Math.sin(to);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${Math.abs(to - from) > Math.PI ? 1 : 0} 1 ${x2} ${y2}`;
  };
  const valAngle = Math.PI - (value / 100) * Math.PI;
  const tgtAngle = Math.PI - (target / 100) * Math.PI;
  const color = value >= target ? "#047857" : value >= target * 0.8 ? "#d97706" : "#dc2626";

  return (
    <svg viewBox="0 0 220 116" style={{ height }} className="w-full">
      <path d={arc(Math.PI, 0, R)} fill="none" stroke="#f3f4f6" strokeWidth={16} strokeLinecap="round" />
      <path d={arc(Math.PI, valAngle, R)} fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" />
      <line
        x1={cx + (R - 12) * Math.cos(tgtAngle)} y1={cy + (R - 12) * Math.sin(tgtAngle)}
        x2={cx + (R + 12) * Math.cos(tgtAngle)} y2={cy + (R + 12) * Math.sin(tgtAngle)}
        stroke="#1d4ed8" strokeWidth={3} strokeLinecap="round"
      />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={30} fontWeight="bold" fill={color}>{value}%</text>
      <text x={cx} y={cy + 17} textAnchor="middle" fontSize={11} fill="#6b7280">Target: {target}%</text>
      <text x={28} y={cy + 16} textAnchor="middle" fontSize={10} fill="#9ca3af">0%</text>
      <text x={192} y={cy + 16} textAnchor="middle" fontSize={10} fill="#9ca3af">100%</text>
    </svg>
  );
}

/** Box-and-whisker plot — pure SVG */
export type BoxPoint = { label: string; min: number; q1: number; median: number; q3: number; max: number; avg: number | null };

export function BoxPlotChart({ data, height = 300 }: { data: BoxPoint[]; height?: number }) {
  if (!data.length)
    return <p className="py-8 text-center text-sm text-gray-400">Not enough data for distribution</p>;

  const mt = 16, mr = 8, mb = 48, ml = 36;
  const cols = data.length;
  const svgW = Math.max(420, cols * 72);
  const svgH = height, plotH = svgH - mt - mb, plotW = svgW - ml - mr;
  const toY = (v: number) => mt + (1 - v / 100) * plotH;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: svgH }}>
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = toY(tick);
          return (
            <g key={tick}>
              <line x1={ml} y1={y} x2={svgW - mr} y2={y} stroke="#f3f4f6" strokeDasharray={tick % 50 ? "3 3" : undefined} />
              <text x={ml - 5} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{tick}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const colW = plotW / cols, cx2 = ml + colW * i + colW / 2;
          const bw = Math.min(38, colW * 0.52), capW = bw * 0.42;
          const yMin = toY(d.min), yQ1 = toY(d.q1), yMed = toY(d.median);
          const yQ3 = toY(d.q3), yMax = toY(d.max);
          const yAvg = d.avg != null ? toY(d.avg) : null;
          return (
            <g key={d.label}>
              <line x1={cx2} y1={yQ1} x2={cx2} y2={yMin} stroke="#d1d5db" strokeWidth={1.5} />
              <line x1={cx2 - capW} y1={yMin} x2={cx2 + capW} y2={yMin} stroke="#d1d5db" strokeWidth={1.5} />
              <rect x={cx2 - bw / 2} y={yQ3} width={bw} height={yQ1 - yQ3} fill="#d1fae5" stroke="#047857" strokeWidth={1.5} rx={3} />
              <line x1={cx2 - bw / 2} y1={yMed} x2={cx2 + bw / 2} y2={yMed} stroke="#047857" strokeWidth={2.5} />
              <line x1={cx2} y1={yQ3} x2={cx2} y2={yMax} stroke="#d1d5db" strokeWidth={1.5} />
              <line x1={cx2 - capW} y1={yMax} x2={cx2 + capW} y2={yMax} stroke="#d1d5db" strokeWidth={1.5} />
              {yAvg != null && <circle cx={cx2} cy={yAvg} r={3.5} fill="#be123c" stroke="white" strokeWidth={1.5} />}
              <text
                x={cx2} y={svgH - mb + 14}
                textAnchor="middle"
                fontSize={cols > 8 ? 8 : 10}
                fill="#6b7280"
                transform={cols > 6 ? `rotate(-28 ${cx2} ${svgH - mb + 14})` : undefined}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center text-xs text-gray-400">
        Box = IQR (Q1–Q3) · Line = median · <span style={{ color: "#be123c" }}>●</span> = mean · Whiskers = min/max
      </p>
    </div>
  );
}

/** Attendance heatmap — day × week */
export type HeatCell = { week: number; day: number; pct: number | null };

const HEATMAP_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function heatColor(pct: number | null) {
  if (pct == null) return "#f9fafb";
  if (pct >= 90) return "#047857";
  if (pct >= 75) return "#34d399";
  if (pct >= 60) return "#fbbf24";
  if (pct >= 40) return "#f97316";
  return "#dc2626";
}

export function HeatmapChart({ data, height = 148 }: { data: HeatCell[]; height?: number }) {
  if (!data.length)
    return <p className="py-6 text-center text-sm text-gray-400">No daily attendance records for this term</p>;

  const weeks = Math.max(...data.map((d) => d.week)) + 1;
  const cs = 18, g = 3, lp = 28, tp = 4;
  const svgW = lp + weeks * (cs + g), svgH = tp + 5 * (cs + g) + 14;
  const cellMap = new Map(data.map((d) => [`${d.week}:${d.day}`, d]));

  return (
    <div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ height, minWidth: Math.min(svgW, 560) }} className="w-full">
          {HEATMAP_DAYS.map((day, di) => (
            <text key={day} x={lp - 4} y={tp + di * (cs + g) + cs * 0.72} textAnchor="end" fontSize={9} fill="#9ca3af">
              {day}
            </text>
          ))}
          {Array.from({ length: weeks }, (_, wi) =>
            Array.from({ length: 5 }, (_, di) => {
              const cell = cellMap.get(`${wi}:${di}`);
              const x = lp + wi * (cs + g), y = tp + di * (cs + g);
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
      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400">
        <span>Low</span>
        {["#dc2626", "#f97316", "#fbbf24", "#34d399", "#047857"].map((c) => (
          <span key={c} style={{ background: c, width: 11, height: 11, borderRadius: 2, display: "inline-block" }} />
        ))}
        <span>High</span>
      </div>
    </div>
  );
}
