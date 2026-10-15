import React from "react";

interface SeriesData {
  name: string;
  values: number[];
}

interface SlideChartProps {
  chartType: "bar" | "line" | "pie";
  categories: string[];
  series: SeriesData[];
  accentColor: string;
  accent2Color: string;
  surfaceColor: string;
  textColor: string;
  mutedColor: string;
  className?: string;
}

function computePieSlices(
  values: number[],
  cats: string[],
  total: number,
  colors: string[]
) {
  let currentAngle = 0;
  return values.map((val, idx) => {
    const sliceAngle = (Math.max(0, val) / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    // SVG Arc coordinates (center 100, 100, radius 70)
    const r = 70;
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    const x1 = 100 + r * Math.cos(startRad);
    const y1 = 100 + r * Math.sin(startRad);
    const x2 = 100 + r * Math.cos(endRad);
    const y2 = 100 + r * Math.sin(endRad);

    const largeArc = sliceAngle > 180 ? 1 : 0;
    const pathData =
      sliceAngle >= 359.9
        ? `M 100 30 A 70 70 0 1 0 100 170 A 70 70 0 1 0 100 30`
        : `M 100 100 L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    const pct = Math.round((val / total) * 100);
    return {
      pathData,
      color: colors[idx % colors.length],
      label: cats[idx] || `Item ${idx + 1}`,
      pct,
      val,
    };
  });
}

export function SlideChart({
  chartType,
  categories,
  series,
  accentColor,
  accent2Color,
  surfaceColor,
  textColor,
  mutedColor,
  className,
}: SlideChartProps) {
  const cats = categories.length > 0 ? categories : ["Q1", "Q2", "Q3", "Q4"];
  const sers = series.length > 0 ? series : [{ name: "Sales", values: [10, 20, 30, 40] }];

  // All values flattened to calculate max
  const allValues = sers.flatMap((s) => s.values);
  const maxVal = Math.max(...allValues, 1);

  if (chartType === "pie") {
    // Single-series pie/donut representation
    const primarySeries = sers[0] || { name: "Share", values: [25, 25, 25, 25] };
    const values = primarySeries.values.slice(0, cats.length);
    const total = values.reduce((sum, v) => sum + Math.max(0, v), 0) || 1;

    // Palette of shades for pie wedges
    const colors = [
      accentColor,
      accent2Color,
      "#10b981",
      "#f59e0b",
      "#8b5cf6",
      "#ec4899",
      "#06b6d4",
      "#64748b",
    ];

    const slices = computePieSlices(values, cats, total, colors);

    return (
      <div className={`flex items-center justify-center gap-[4cqw] w-full h-full ${className || ""}`}>
        <div className="w-[18cqw] h-[18cqw] shrink-0">
          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-sm">
            {slices.map((slice, idx) => (
              <path key={idx} d={slice.pathData} fill={slice.color} stroke={surfaceColor} strokeWidth="2" />
            ))}
          </svg>
        </div>
        <div className="flex flex-col gap-[1cqw] text-[1.8cqw] max-h-full overflow-hidden">
          {slices.map((slice, idx) => (
            <div key={idx} className="flex items-center gap-[1cqw]">
              <span className="w-[1cqw] h-[1cqw] rounded-sm shrink-0" style={{ backgroundColor: slice.color }} />
              <span className="font-semibold" style={{ color: textColor }}>{slice.label}:</span>
              <span className="font-bold" style={{ color: accentColor }}>{slice.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (chartType === "line") {
    const width = 400;
    const height = 180;
    const paddingX = 40;
    const paddingY = 25;
    const plotW = width - paddingX * 2;
    const plotH = height - paddingY * 2;

    const colors = [accentColor, accent2Color, "#10b981"];

    return (
      <div className={`flex flex-col w-full h-full justify-center ${className || ""}`}>
        <div className="w-full h-[20cqw]">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const y = paddingY + plotH * (1 - pct);
              return (
                <line
                  key={i}
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke={surfaceColor}
                  strokeWidth="1"
                  strokeDasharray="4 2"
                />
              );
            })}

            {/* Render lines for each series */}
            {sers.map((ser, sIdx) => {
              const pts = ser.values.slice(0, cats.length).map((v, cIdx) => {
                const x = paddingX + (cIdx / Math.max(1, cats.length - 1)) * plotW;
                const y = paddingY + plotH * (1 - v / maxVal);
                return { x, y, v };
              });

              const polylinePts = pts.map((p) => `${p.x},${p.y}`).join(" ");
              const color = colors[sIdx % colors.length];

              return (
                <g key={sIdx}>
                  <polyline
                    points={polylinePts}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {pts.map((p, pIdx) => (
                    <circle key={pIdx} cx={p.x} cy={p.y} r="4" fill={color} stroke="#ffffff" strokeWidth="2" />
                  ))}
                </g>
              );
            })}

            {/* Category labels on X axis */}
            {cats.map((cat, cIdx) => {
              const x = paddingX + (cIdx / Math.max(1, cats.length - 1)) * plotW;
              return (
                <text
                  key={cIdx}
                  x={x}
                  y={height - 5}
                  textAnchor="middle"
                  fontSize="10"
                  fill={mutedColor}
                  fontWeight="500"
                >
                  {cat}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        {sers.length > 1 && (
          <div className="flex justify-center gap-[3cqw] mt-[1cqw] text-[1.6cqw]">
            {sers.map((s, idx) => (
              <div key={idx} className="flex items-center gap-[0.8cqw]">
                <span className="w-[1.2cqw] h-[0.3cqw] rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
                <span style={{ color: textColor }}>{s.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default: Bar Chart (Vertical)
  const colors = [accentColor, accent2Color, "#10b981"];

  return (
    <div className={`flex flex-col w-full h-full justify-center px-[2cqw] ${className || ""}`}>
      <div className="flex items-end justify-between gap-[2cqw] h-[18cqw] border-b pb-[1cqw]" style={{ borderColor: surfaceColor }}>
        {cats.map((cat, cIdx) => (
          <div key={cIdx} className="flex-1 flex flex-col items-center h-full justify-end group">
            <div className="flex gap-[0.5cqw] items-end justify-center w-full h-[85%]">
              {sers.map((ser, sIdx) => {
                const val = ser.values[cIdx] ?? 0;
                const heightPct = Math.max(4, Math.round((val / maxVal) * 100));
                const color = colors[sIdx % colors.length];
                return (
                  <div
                    key={sIdx}
                    className="flex-1 max-w-[4cqw] rounded-t-sm transition-all duration-300 relative"
                    style={{ height: `${heightPct}%`, backgroundColor: color }}
                  >
                    <span className="absolute -top-[2cqw] left-1/2 -translate-x-1/2 text-[1.4cqw] font-bold" style={{ color: textColor }}>
                      {val}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="text-[1.8cqw] font-semibold mt-[1cqw] text-center truncate max-w-full" style={{ color: mutedColor }}>
              {cat}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      {sers.length > 1 && (
        <div className="flex justify-center gap-[3cqw] mt-[1.5cqw] text-[1.6cqw]">
          {sers.map((s, idx) => (
            <div key={idx} className="flex items-center gap-[0.8cqw]">
              <span className="w-[1cqw] h-[1cqw] rounded-sm" style={{ backgroundColor: colors[idx % colors.length] }} />
              <span style={{ color: textColor }}>{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
