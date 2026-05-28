/**
 * SVG Line Chart — matches the HTML prototype's svgLine() function.
 * Renders a proper line chart with:
 *  - Y-axis grid lines and labels
 *  - Smooth line path with area fill
 *  - Data point dots
 *  - X-axis labels
 */

type DataPoint = { label: string; value: number };

interface Props {
  data: DataPoint[];
  color?: string;
  width?: number;
  height?: number;
  unit?: string;
}

export default function SvgLineChart({
  data,
  color = '#146484',
  width = 460,
  height = 160,
  unit = '',
}: Props) {
  if (!data.length) {
    return (
      <div style={{ color: 'var(--color-text3)', padding: 30, textAlign: 'center', fontSize: 12 }}>
        No data available
      </div>
    );
  }

  const padL = 52, padR = 20, padT = 14, padB = 28;
  const gw = width - padL - padR;
  const gh = height - padT - padB;

  const vals = data.map((d) => d.value || 0);
  const maxV = Math.max(...vals) || 1;

  const px = (i: number) => padL + Math.round(i / ((data.length - 1) || 1) * gw);
  const py = (v: number) => padT + Math.round(gh - (v / maxV) * gh);

  // Grid lines at 0%, 25%, 50%, 75%, 100%
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const y = padT + Math.round(gh * (1 - f));
    const lbl = unit === 'R'
      ? Math.round(maxV * f).toLocaleString()
      : Math.round(maxV * f).toLocaleString();
    return (
      <g key={f}>
        <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#e0e0e0" strokeWidth={1} />
        <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={8} fill="#aaa" fontFamily="Arial">
          {lbl}
        </text>
      </g>
    );
  });

  // Line path
  const linePoints = data.map((d, i) => `${px(i)},${py(d.value || 0)}`).join(' L');
  const linePath = `M${linePoints}`;

  // Area fill
  const areaPath = `M${px(0)},${py(0)} ` +
    data.map((d, i) => `L${px(i)},${py(d.value || 0)}`).join(' ') +
    ` L${px(data.length - 1)},${py(0)} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {gridLines}
      <path d={areaPath} fill={color} opacity={0.08} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.map((d, i) => (
        <g key={i}>
          <circle
            cx={px(i)}
            cy={py(d.value || 0)}
            r={3.5}
            fill={color}
            stroke="white"
            strokeWidth={1.5}
          />
          <text
            x={px(i)}
            y={height - padB + 14}
            textAnchor="middle"
            fontSize={8}
            fill="#888"
            fontFamily="Arial"
          >
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
