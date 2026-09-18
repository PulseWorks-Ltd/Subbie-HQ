// Dependency-free SVG donut — no charting library exists anywhere in this
// codebase, and the Portfolio Profitability dashboard section explicitly
// must not add one for a single two-slice chart. Built from plain <circle>
// strokes using stroke-dasharray/stroke-dashoffset, the standard technique
// for an SVG donut with no path-arc math required.
export function DonutChart({
  segments,
  size = 96,
  strokeWidth = 14
}: {
  segments: { value: number; colorClassName: string; label: string }[];
  size?: number;
  strokeWidth?: number;
}) {
  const total = segments.reduce((sum, segment) => sum + Math.max(segment.value, 0), 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offsetAccum = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      // Rotate so the first segment starts at 12 o'clock rather than 3
      // o'clock (stroke-dasharray's natural start point).
      className="-rotate-90"
      role="img"
      aria-label={segments.map((segment) => `${segment.label}: ${segment.value}`).join(", ")}
    >
      {total <= 0 ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-slate-100 dark:stroke-slate-800"
        />
      ) : (
        segments.map((segment, index) => {
          const fraction = Math.max(segment.value, 0) / total;
          const dashLength = fraction * circumference;
          const dashOffset = -offsetAccum;
          offsetAccum += dashLength;

          return (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset}
              strokeLinecap={segments.length > 1 ? "butt" : "round"}
              className={segment.colorClassName}
            />
          );
        })
      )}
    </svg>
  );
}
