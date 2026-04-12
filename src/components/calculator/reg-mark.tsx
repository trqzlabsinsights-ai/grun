"use client";

export function RegMark({ x, y }: { x: number; y: number }) {
  const r = 0.18;
  return (
    <g>
      <line x1={x - r} y1={y} x2={x + r} y2={y} stroke="#f97316" strokeWidth={0.03} />
      <line x1={x} y1={y - r} x2={x} y2={y + r} stroke="#f97316" strokeWidth={0.03} />
      <circle cx={x} cy={y} r={0.06} fill="none" stroke="#f97316" strokeWidth={0.025} />
    </g>
  );
}
