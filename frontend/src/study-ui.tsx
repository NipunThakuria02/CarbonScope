import type React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
export type O = Record<string, any>;
export const colors = [
  '#f39865',
  '#a6c3cd',
  '#bbb4d2',
  '#d6b37b',
  '#81b6a3',
  '#d58b88',
];
export const sectorKeys = [
  'power',
  'industry',
  'ground_transport',
  'residential',
  'domestic_aviation',
  'international_aviation',
];
export const labels: O = {
  power: 'Power',
  industry: 'Industry',
  ground_transport: 'Road transport',
  residential: 'Buildings',
  domestic_aviation: 'Domestic aviation',
  international_aviation: 'International aviation',
};
export const fmt = (v: any, d = 2) =>
  v == null
    ? '-'
    : Number(v).toLocaleString('en-IN', { maximumFractionDigits: d });
export const date = (s: string) =>
  new Date(s + '-01T12:00:00').toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });

export function Card({
  title,
  sub,
  children,
  className = '',
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={'card ' + className}>
      <div className="card-heading">
        <h3>{title}</h3>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </section>
  );
}
export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="tag">{children}</span>;
}
export function Formula({ formula, text }: { formula: string; text: string }) {
  return (
    <div className="formula">
      <code>{formula}</code>
      <p>{text}</p>
    </div>
  );
}
export function Stat({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: any;
  unit?: string;
  note: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>
        {value} <em>{unit}</em>
      </strong>
      <small>{note}</small>
    </div>
  );
}
export function Trend({
  rows,
  fields,
  height = 290,
}: {
  rows: O[];
  fields: { key: string; name: string; color?: string; dashed?: boolean }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={rows}
        margin={{ top: 15, left: 0, right: 18, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 5"
          vertical={false}
          stroke="#657071"
        />
        <XAxis
          dataKey="month"
          tickFormatter={(v) => date(v)}
          minTickGap={65}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          width={65}
          tickFormatter={(v) => fmt(v, Math.abs(v) < 10 ? 1 : 0)}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          labelFormatter={(v) => date(String(v))}
          formatter={(v: any) => fmt(v) + ' Mt'}
        />
        <Legend />
        {fields.map((f, i) => (
          <Line
            key={f.key}
            type="linear"
            isAnimationActive={
              !window.matchMedia('(prefers-reduced-motion: reduce)').matches
            }
            animationDuration={900}
            animationEasing="ease-out"
            dataKey={f.key}
            name={f.name}
            stroke={f.color || colors[i % 6]}
            strokeWidth={2.4}
            dot={false}
            connectNulls={false}
            strokeDasharray={f.dashed ? '6 5' : undefined}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
export const explanation: O = {
  kmeans: {
    title: 'K-Means',
    formula: 'J = Σₖ Σₓ∈Cₖ ‖x − μₖ‖²',
    text: 'Groups similar emission profiles around cluster centres. Lower within-cluster distance means a tighter grouping.',
  },
  gmm: {
    title: 'Gaussian Mixture + EM',
    formula: 'p(x) = Σₖ πₖ N(x | μₖ, Σₖ)',
    text: 'Assigns probabilities to groups. EM alternates membership estimation and parameter updates until the fit stabilises.',
  },
  hierarchical: {
    title: 'Hierarchical clustering',
    formula: 'Δ(A,B) = nₐnᵦ/(nₐ+nᵦ) · ‖μₐ−μᵦ‖²',
    text: 'Ward linkage merges groups that add the least squared error. The dendrogram shows this merging structure.',
  },
  pca: {
    title: 'Principal Component Analysis',
    formula: 'Explained varianceⱼ = λⱼ / Σλ',
    text: 'Compresses six sector features into a few combined dimensions. Used for visualisation and forecasting features.',
  },
  factor: {
    title: 'Factor Analysis',
    formula: 'x = μ + Λz + ε',
    text: 'Represents shared patterns with latent factors, while allowing feature-specific noise.',
  },
};
