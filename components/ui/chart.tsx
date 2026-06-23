"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<"light" | "dark", string> }
  );
};

type ChartContextProps = { config: ChartConfig };

const ChartContext = React.createContext<ChartContextProps | null>(null);

export function useChart() {
  const ctx = React.useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used within <ChartContainer>");
  return ctx;
}

// ---------------------------------------------------------------------------
// ChartContainer
// ---------------------------------------------------------------------------

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uid = React.useId();
  const chartId = `chart-${id ?? uid.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          "flex w-full justify-center text-xs",
          // Recharts overrides — keep axes/grid legible
          "[&_.recharts-cartesian-axis-tick_text]:fill-gray-500",
          "[&_.recharts-cartesian-grid_line]:stroke-gray-100",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-gray-200",
          "[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-gray-50",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// ChartStyle — injects per-key CSS colour variables
// ---------------------------------------------------------------------------

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const coloured = Object.entries(config).filter(([, c]) => c.theme || c.color);
  if (!coloured.length) return null;

  const css = Object.entries({ light: "", dark: ".dark" })
    .flatMap(([theme, prefix]) =>
      coloured.map(([key, cfg]) => {
        const color = cfg.theme?.[theme as "light" | "dark"] ?? cfg.color;
        return color
          ? `${prefix} [data-chart=${id}]{--color-${key}:${color};}`
          : null;
      })
    )
    .filter(Boolean)
    .join(" ");

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

// ---------------------------------------------------------------------------
// ChartTooltip & ChartTooltipContent
// ---------------------------------------------------------------------------

export const ChartTooltip = RechartsPrimitive.Tooltip;

export function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  labelKey,
  nameKey,
  formatter,
  hideLabel = false,
  hideIndicator = false,
  indicator = "dot",
  color,
  className,
  labelClassName,
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> & {
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: "dot" | "line" | "dashed";
  nameKey?: string;
  labelKey?: string;
}) {
  const { config } = useChart();

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) return null;
    const [item] = payload as { dataKey?: string; name?: string; payload?: Record<string, unknown> }[];
    const key = labelKey ?? (item.dataKey as string) ?? item.name ?? "value";
    const cfgEntry = config[key];
    const value =
      !labelKey && typeof label === "string"
        ? config[label]?.label ?? label
        : cfgEntry?.label;
    if (!value) return null;
    return (
      <div className={cn("font-medium text-gray-900", labelClassName)}>
        {labelFormatter ? labelFormatter(value, payload) : value}
      </div>
    );
  }, [hideLabel, label, labelFormatter, labelKey, payload, config, labelClassName]);

  if (!active || !payload?.length) return null;
  const nestLabel = payload.length === 1 && indicator !== "dot";

  return (
    <div
      className={cn(
        "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 shadow-xl",
        className
      )}
    >
      {!nestLabel && tooltipLabel}
      <div className="grid gap-1.5">
        {(payload as { value?: unknown; name?: string; dataKey?: string; color?: string; payload?: Record<string, unknown> }[]).map((item, idx) => {
          const key = nameKey ?? item.name ?? (item.dataKey as string) ?? "value";
          const cfgEntry = config[key];
          const dotColor = color ?? (item.payload?.fill as string) ?? item.color;
          return (
            <div
              key={item.dataKey ?? idx}
              className={cn(
                "flex w-full items-center gap-2",
                indicator === "dot" && "items-center"
              )}
            >
              {formatter && item.value !== undefined && item.name ? (
                formatter(item.value as number, item.name, item as never, idx, item.payload as never)
              ) : (
                <>
                  {cfgEntry?.icon ? (
                    <cfgEntry.icon />
                  ) : (
                    !hideIndicator && (
                      <span
                        className={cn("shrink-0 rounded-[2px]", {
                          "h-2.5 w-2.5": indicator === "dot",
                          "h-4 w-1": indicator === "line",
                          "h-4 w-0 border border-dashed border-[color:var(--color-bg)] bg-transparent":
                            indicator === "dashed",
                        })}
                        style={{ backgroundColor: dotColor } as React.CSSProperties}
                      />
                    )
                  )}
                  <div className="flex flex-1 items-center justify-between leading-none">
                    <div>
                      {nestLabel && tooltipLabel}
                      <span className="text-gray-500">
                        {cfgEntry?.label ?? item.name}
                      </span>
                    </div>
                    {item.value !== undefined && (
                      <span className="ml-2 font-mono font-medium tabular-nums text-gray-900">
                        {typeof item.value === "number"
                          ? item.value.toLocaleString()
                          : String(item.value)}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChartLegend & ChartLegendContent
// ---------------------------------------------------------------------------

export const ChartLegend = RechartsPrimitive.Legend;

export function ChartLegendContent({
  payload,
  nameKey,
  hideIcon = false,
  verticalAlign = "bottom",
  className,
}: React.ComponentProps<"div"> & {
  hideIcon?: boolean;
  nameKey?: string;
  payload?: { value: string; color?: string; dataKey?: string }[];
  verticalAlign?: "top" | "bottom";
}) {
  const { config } = useChart();
  if (!payload?.length) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {payload.map((item) => {
        const key = nameKey ?? item.dataKey ?? item.value;
        const cfgEntry = config[key];
        return (
          <div key={item.value} className="flex items-center gap-1.5 text-xs text-gray-600">
            {cfgEntry?.icon && !hideIcon ? (
              <cfgEntry.icon />
            ) : (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: item.color }}
              />
            )}
            <span>{cfgEntry?.label ?? item.value}</span>
          </div>
        );
      })}
    </div>
  );
}
