import { api } from './api';
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  Tooltip,
  ScatterChart,
  Scatter,
  CartesianGrid,
  YAxis,
} from 'recharts';
import {
  Search,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Play,
  Pause,
  Info,
  Download,
  Layers3,
  Globe2,
  ChartNoAxesCombined,
  X,
} from 'lucide-react';
import type { GlobePoint } from './Globe';
const Globe = lazy(() => import('./Globe'));
type O = Record<string, any>;
const keys = [
  'power',
  'industry',
  'ground_transport',
  'residential',
  'domestic_aviation',
  'international_aviation',
];
const names: Record<string, string> = {
  power: 'Power',
  industry: 'Industry',
  ground_transport: 'Ground transport',
  residential: 'Residential',
  domestic_aviation: 'Domestic aviation',
  international_aviation: 'International aviation',
};
const palette = [
  '#65d9e2',
  '#e8bd50',
  '#ef9364',
  '#b2a0e1',
  '#89c9a5',
  '#78aadd',
];
const n = (value: number | undefined, d = 2) =>
  value === undefined
    ? '-'
    : value.toLocaleString('en-IN', { maximumFractionDigits: d });
const date = (value: string) =>
  value.length === 4
    ? value
    : new Date(value + '-01T12:00:00').toLocaleDateString('en-GB', {
        month: 'short',
        year: 'numeric',
      });

function useReducedMotion() {
  const [state, S] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)'),
      update = () => S(q.matches);
    q.addEventListener('change', update);
    return () => q.removeEventListener('change', update);
  }, []);
  return state;
}
function CountrySearch({
  countries,
  country,
  onCountry,
}: {
  countries: string[];
  country: string;
  onCountry: (v: string) => void;
}) {
  const [query, Q] = useState(country);
  useEffect(() => Q(country), [country]);
  function commit(value: string) {
    const match = countries.find(
      (c) => c.toLowerCase() === value.toLowerCase(),
    );
    if (match) onCountry(match);
    return !!match;
  }
  return (
    <label className="explorer-search">
      <Search size={17} />
      <input
        aria-label="Find a study country"
        type="search"
        list="explorer-countries"
        value={query}
        placeholder="Find a study country"
        onChange={(e) => {
          Q(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => {
          if (!commit(query)) Q(country);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const match = countries.filter((c) =>
              c.toLowerCase().includes(query.toLowerCase()),
            );
            if (match.length === 1) {
              onCountry(match[0]);
              Q(match[0]);
            }
          }
        }}
      />
      <datalist id="explorer-countries">
        {countries.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </label>
  );
}
function Select({
  name,
  value,
  onChange,
  children,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="explorer-filter">
      <span className="sr-only">{name}</span>
      <select
        aria-label={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <ChevronDown size={15} />
    </label>
  );
}
function PeriodControl({
  periods,
  period,
  onPeriod,
  playing,
  onPlaying,
}: {
  periods: string[];
  period: string;
  onPeriod: (v: string) => void;
  playing: boolean;
  onPlaying: (v: boolean) => void;
}) {
  const index = Math.max(0, periods.indexOf(period));
  return (
    <div className="period-control">
      <button
        aria-label={playing ? 'Pause timeline' : 'Play timeline'}
        aria-pressed={playing}
        onClick={() => {
          if (!playing && index === periods.length - 1) onPeriod(periods[0]);
          onPlaying(!playing);
        }}
      >
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <button
        aria-label="Previous period"
        disabled={index === 0}
        onClick={() => {
          onPlaying(false);
          onPeriod(periods[index - 1]);
        }}
      >
        <ChevronLeft size={18} />
      </button>
      <div className="period-scrubber">
        <label htmlFor="explorer-time">{date(period)}</label>
        <input
          id="explorer-time"
          aria-label="Timeline period"
          type="range"
          min="0"
          max={Math.max(0, periods.length - 1)}
          value={index}
          onChange={(e) => {
            onPlaying(false);
            onPeriod(periods[+e.target.value]);
          }}
        />
      </div>
      <button
        aria-label="Next period"
        disabled={index === periods.length - 1}
        onClick={() => {
          onPlaying(false);
          onPeriod(periods[index + 1]);
        }}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
function usePlayback(
  periods: string[],
  period: string,
  onPeriod: (v: string) => void,
) {
  const [playing, P] = useState(false),
    callback = useRef(onPeriod);
  callback.current = onPeriod;
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const i = periods.indexOf(period);
      if (i >= periods.length - 1) P(false);
      else callback.current(periods[i + 1]);
    }, 1400);
    return () => clearInterval(id);
  }, [playing, period, periods.join('|')]);
  return { playing, onPlaying: P };
}
function TinyBars({
  rows,
  selected,
  onSelect,
  reduced,
}: {
  rows: O[];
  selected: string;
  onSelect?: (v: string) => void;
  reduced: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={110}>
      <BarChart
        accessibilityLayer
        data={rows}
        margin={{ left: 0, right: 0, top: 7, bottom: 0 }}
        barCategoryGap="18%"
      >
        <XAxis
          dataKey="period"
          tickFormatter={(v) =>
            rows.length <= 24 ? date(String(v)) : String(v).slice(0, 4)
          }
          interval={Math.max(0, Math.floor(rows.length / 4) - 1)}
          padding={{ left: 10, right: 10 }}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: '#666b6b' }}
        />
        <Tooltip
          labelFormatter={(v) => date(String(v))}
          formatter={(v: any) => [n(Number(v), 3) + ' Mt CO₂', 'Emissions']}
        />
        <Bar
          dataKey="value"
          name="Emissions"
          radius={[1, 1, 0, 0]}
          isAnimationActive={!reduced}
          animationDuration={850}
          animationEasing="ease-out"
          onClick={(r: any) => {
            const period = r.period ?? r.payload?.period;
            if (period) onSelect?.(period);
          }}
        >
          {rows.map((r, i) => (
            <Cell
              key={r.period + '-' + i}
              fill={
                r.forecast
                  ? '#e58b5c'
                  : r.period === selected
                    ? '#229da9'
                    : '#72dbe1'
              }
              opacity={r.period === selected ? 1 : 0.8}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
function MapLegend({
  items,
  children,
}: {
  items: { label: string; color: string }[];
  children?: ReactNode;
}) {
  return (
    <div className="map-legend">
      <span className="explorer-eyebrow">COLOUR LEGEND</span>
      {items.map((r) => (
        <div key={r.label}>
          <i style={{ background: r.color }} />
          <span>{r.label}</span>
        </div>
      ))}
      <p>
        {children ||
          'Country-level totals. Marker height is log-scaled relative to the selected period.'}
      </p>
    </div>
  );
}
function ExplorerShell({
  kind,
  title,
  toolbar,
  summary,
  points,
  country,
  onCountry,
  periodLabel,
  periods,
  period,
  onPeriod,
  playback,
  legend,
  children,
  details,
  alternative,
  error,
  busy,
}: {
  kind: string;
  title: string;
  toolbar: ReactNode;
  summary: ReactNode;
  points: GlobePoint[];
  country: string;
  onCountry: (v: string) => void;
  periodLabel: string;
  periods: string[];
  period: string;
  onPeriod: (v: string) => void;
  playback: { playing: boolean; onPlaying: (v: boolean) => void };
  legend: { label: string; color: string }[];
  children?: ReactNode;
  details: ReactNode;
  alternative?: ReactNode;
  error?: string;
  busy?: boolean;
}) {
  const [open, S] = useState(false),
    [showLegend, L] = useState(false),
    [help, H] = useState(false);
  return (
    <>
      <section className={'explorer-stage explorer-' + kind} aria-label={title}>
        <div className="explorer-toolbar">
          {toolbar}
          <span className="metric-pill">Mt CO₂</span>
        </div>
        <div className="explorer-ambient" />
        <div className="explorer-orbit" aria-hidden="true" />
        <div
          className={
            'explorer-visual ' + (alternative ? 'has-alternative' : '')
          }
        >
          {alternative || (
            <Suspense
              fallback={<div className="globe-loading">Opening the globe…</div>}
            >
              <Globe
                points={points}
                country={country}
                onCountry={onCountry}
                periodLabel={periodLabel}
                focusCountry
              />
            </Suspense>
          )}
        </div>
        <div className="explorer-map-heading">
          <span className="explorer-eyebrow">
            CARBONSCOPE EXPLORER V2 / {title.toUpperCase()}
          </span>
          <h1>{title}</h1>
          <p>
            {kind === 'future'
              ? 'A view of what might come next.'
              : kind === 'patterns'
                ? 'See the similarities. Explore the differences.'
                : 'A closer look at our changing world.'}
          </p>
        </div>
        <div className="explorer-map-meta">
          <span className="record-indicator" />
          {kind === 'future'
            ? 'SAVED FORECASTS'
            : kind === 'patterns'
              ? 'MODEL PROFILES'
              : 'PUBLISHED ESTIMATES'}
          <span>{periodLabel}</span>
        </div>
        {busy && (
          <span className="map-loading" role="status">
            Updating view…
          </span>
        )}
        {error && (
          <div className="map-load-error" role="alert">
            {error}
          </div>
        )}
        <article className="emissions-summary">
          {summary}
          <button
            className="summary-more"
            aria-expanded={open}
            aria-controls="explorer-details"
            onClick={() => {
              S(!open);
              if (!open)
                requestAnimationFrame(() =>
                  document.getElementById('explorer-details')?.scrollIntoView({
                    behavior: window.matchMedia(
                      '(prefers-reduced-motion: reduce)',
                    ).matches
                      ? 'instant'
                      : 'smooth',
                    block: 'start',
                  }),
                );
            }}
          >
            {open ? 'Less detail' : 'More details'}
            {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </article>
        <div className="explorer-bottom">
          <PeriodControl
            periods={periods}
            period={period}
            onPeriod={onPeriod}
            {...playback}
          />
          <div className="map-actions">
            <button aria-expanded={showLegend} onClick={() => L(!showLegend)}>
              Legend <Layers3 size={15} />
            </button>
            <button aria-expanded={help} onClick={() => H(!help)}>
              How to use <Info size={15} />
            </button>
          </div>
        </div>
        {showLegend && (
          <MapLegend items={legend}>
            {kind === 'patterns'
              ? 'Group colours are model labels, not rankings. Similarity plots use PCA coordinates.'
              : 'Colour identifies the largest sector, or the selected sector. Height is relative and log-scaled. One national-period total per country, not individual facilities.'}
          </MapLegend>
        )}
        {help && (
          <div className="explorer-help">
            <button aria-label="Close explorer help" onClick={() => H(false)}>
              <X size={16} />
            </button>
            <h3>Take a closer look.</h3>
            <p>
              Find a country, choose a period and adjust the filters. Drag the
              globe to rotate it; use its controls to pause or zoom. Play the
              timeline to move through the available periods.
            </p>
            <p>
              {kind === 'future'
                ? 'These are saved estimates, not live observations.'
                : 'Colours and values change with your selected data.'}{' '}
              Open More details for charts, tables and the research behind this
              view.
            </p>
          </div>
        )}
        <div className="map-attribution">
          Natural Earth · Carbon Monitor{' '}
          {kind === 'future'
            ? 'source + CarbonScope forecasts'
            : 'published estimates'}
          <span>
            {kind === 'future'
              ? 'Predictions · not observations'
              : 'Country locations · not facilities'}
          </span>
        </div>
        {children}
      </section>
      <section
        className={'explorer-details ' + (open ? 'expanded' : '')}
        id="explorer-details"
        aria-label={title + ' details'}
      >
        {open && (
          <>
            <div className="explorer-detail-top">
              <span className="explorer-eyebrow">
                {title.toUpperCase()} / DETAILS
              </span>
              <button
                onClick={() => {
                  S(false);
                  window.scrollTo({ top: 0, behavior: 'instant' });
                }}
              >
                Back to explorer <ChevronUp size={15} />
              </button>
            </div>
            {details}
          </>
        )}
      </section>
    </>
  );
}
function useMapData(url: string) {
  const [map, M] = useState<O>(),
    [busy, B] = useState(false),
    [error, E] = useState('');
  useEffect(() => {
    let live = true;
    B(true);
    E('');
    M(undefined);
    api(url)
      .then((r) => {
        if (live) M(r);
      })
      .catch((e) => {
        if (live) {
          M(undefined);
          E(e.message);
        }
      })
      .finally(() => {
        if (live) B(false);
      });
    return () => {
      live = false;
    };
  }, [url]);
  return { map, busy, error };
}
function sectorColour(row: O, sector: string) {
  const index =
    sector === 'all'
      ? keys.indexOf(keys.reduce((a, b) => (row[a] > row[b] ? a : b)))
      : keys.indexOf(sector);
  return palette[Math.max(0, index)];
}
export function CountryExplorer({
  boot,
  data,
  country,
  onCountry,
  details,
}: {
  boot: O;
  data?: O;
  country: string;
  onCountry: (v: string) => void;
  details: ReactNode;
}) {
  const [sector, S] = useState('all'),
    [aggregation, A] = useState('monthly'),
    [period, T] = useState(boot.months.at(-1));
  const reduced = useReducedMotion();
  const periods: string[] =
    aggregation === 'monthly'
      ? boot.months
      : Array.from(
          new Set<string>(boot.months.map((m: string) => m.slice(0, 4))),
        );
  const { map, busy, error } = useMapData(
    `/explorer?mode=observed&period=${period}&aggregation=${aggregation}&sector=${sector}`,
  );
  const row = map?.items.find((r: O) => r.country === country);
  const value = row?.total_co2;
  const series: O[] = data
    ? aggregation === 'monthly'
      ? data.history.map((r: O) => ({
          period: r.month,
          value: sector === 'all' ? r.observed : r[sector],
        }))
      : periods.map((year) => ({
          period: year,
          value: data.history
            .filter((r: O) => r.month.startsWith(year))
            .reduce(
              (sum: number, r: O) =>
                sum + (sector === 'all' ? r.observed : r[sector]),
              0,
            ),
        }))
    : [];
  const points = (map?.items || []).map((r: O) => ({
    country: r.country,
    total_co2: r.total_co2,
    color: sectorColour(r, sector),
  }));
  const playback = usePlayback(periods, period, T);
  const title = sector === 'all' ? 'All sectors' : names[sector];
  const total = map?.items.reduce((sum: number, r: O) => sum + r.total_co2, 0);
  return (
    <ExplorerShell
      kind="country"
      title="Explore country emissions"
      toolbar={
        <>
          <CountrySearch
            countries={boot.countries}
            country={country}
            onCountry={onCountry}
          />
          <Select name="Emissions sector" value={sector} onChange={S}>
            <option value="all">All sectors</option>
            {keys.map((k) => (
              <option key={k} value={k}>
                {names[k]}
              </option>
            ))}
          </Select>
          <Select
            name="Observation period"
            value={period}
            onChange={(v) => {
              playback.onPlaying(false);
              T(v);
            }}
          >
            {periods.map((m) => (
              <option key={m} value={m}>
                {date(m)}
              </option>
            ))}
          </Select>
          <div className="aggregation-switch" aria-label="Time aggregation">
            {['monthly', 'annual'].map((mode) => (
              <button
                key={mode}
                aria-pressed={aggregation === mode}
                onClick={() => {
                  playback.onPlaying(false);
                  A(mode);
                  T(
                    mode === 'annual'
                      ? period.slice(0, 4)
                      : boot.months
                          .filter((m: string) =>
                            m.startsWith(period.slice(0, 4)),
                          )
                          .at(-1),
                  );
                }}
              >
                {mode === 'monthly' ? 'Monthly' : 'Annual'}
              </button>
            ))}
          </div>
        </>
      }
      summary={
        <div className="summary-content">
          <span className="explorer-eyebrow">PUBLISHED EMISSIONS</span>
          <h2>
            {country}: {title}
          </h2>
          <p className="summary-period">
            {date(period)}
            {map?.partial_year
              ? ` · ${map.months_in_period} reported months`
              : ''}
          </p>
          <div className="summary-value" key={country + period + sector}>
            {n(value)}
            <small>Mt</small>
          </div>
          <p className="summary-unit">
            CO₂{' '}
            <span>
              {aggregation === 'annual' ? 'period total' : 'per month'}
            </span>
          </p>
          <div className="summary-facts">
            <strong>{map?.items.length ?? '-'}</strong> study countries ·{' '}
            {sector === 'all' ? 'six reported sectors' : title}
          </div>
          <div className="summary-chart">
            <span className="chart-kicker">
              {aggregation === 'annual' ? 'ANNUAL HISTORY' : 'MONTHLY HISTORY'}
            </span>
            <TinyBars
              rows={series}
              selected={period}
              onSelect={T}
              reduced={reduced}
            />
          </div>
          <div className="summary-coverage">
            Study-cohort total: {n(total)} Mt
            {map?.partial_year && (
              <span>Partial year; not a full annual total.</span>
            )}
          </div>
        </div>
      }
      points={points}
      country={country}
      onCountry={onCountry}
      periodLabel={date(period)}
      periods={periods}
      period={period}
      onPeriod={T}
      playback={playback}
      legend={keys.map((k, i) => ({ label: names[k], color: palette[i] }))}
      details={details}
      error={error}
      busy={busy}
    />
  );
}
export function PatternsExplorer({
  boot,
  data,
  country,
  onCountry,
  details,
}: {
  boot: O;
  data?: O;
  country: string;
  onCountry: (v: string) => void;
  details: (
    family: string,
    month: string,
    onFamily: (v: string) => void,
    onMonth: (v: string) => void,
  ) => ReactNode;
}) {
  const [family, F] = useState('gmm'),
    [month, M] = useState(boot.months.at(-1)),
    [view, V] = useState('globe');
  const reduced = useReducedMotion();
  const periods: string[] = boot.months.filter(
    (m: string) => family !== 'hierarchical' || m <= '2022-12',
  );
  const { map, busy, error } = useMapData(
    `/atlas?model=${family}&month=${month}`,
  );
  const current = map?.items.find((p: O) => p.country === country),
    k = boot.research.selected[family].k;
  const points = (map?.items || []).map((r: O) => ({
    country: r.country,
    total_co2: r.total_co2,
    color: palette[r[family] % palette.length],
  }));
  const playback = usePlayback(periods, month, M);
  const methodName =
    family === 'gmm'
      ? 'Gaussian mixture'
      : family === 'kmeans'
        ? 'K-Means'
        : 'Ward hierarchy';
  const profileHistory = (data?.assignments || [])
    .filter((r: O) => family !== 'hierarchical' || r.month <= '2022-12')
    .map((r: O) => ({ period: r.month, value: r.total_co2 }));
  const scatter = (
    <div className="profile-canvas">
      <div className="profile-plot-title">
        <span className="explorer-eyebrow">THE PROFILE SPACE</span>
        <h2>
          Different countries.
          <br />
          Shared patterns.
        </h2>
        <p>
          Two PCA dimensions ·{' '}
          {n(
            boot.research.pca.variance
              .slice(0, 2)
              .reduce((s: number, x: number) => s + x, 0) * 100,
            2,
          )}
          % reference variance
        </p>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 165, right: 55, bottom: 55, left: 45 }}>
          <CartesianGrid stroke="#72828655" strokeDasharray="2 7" />
          <XAxis
            type="number"
            dataKey="pc1"
            name="PC1"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="number"
            dataKey="pc2"
            name="PC2"
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="chart-tooltip">
                  <b>{payload[0].payload.country}</b>
                  <p>Group {payload[0].payload[family]}</p>
                </div>
              ) : null
            }
          />
          {Array.from({ length: k }, (_, i) => (
            <Scatter
              key={family + '-' + i}
              name={'Group ' + i}
              shape={(p: any) => (
                <circle
                  cx={p.cx}
                  cy={p.cy}
                  r={p.payload?.country === country ? 7 : 4.5}
                  fill={p.fill}
                  stroke={p.payload?.country === country ? '#fff4d7' : 'none'}
                  strokeWidth={2}
                />
              )}
              data={(map?.items || []).filter((r: O) => r[family] === i)}
              fill={palette[i % 6]}
              isAnimationActive={!reduced}
              animationDuration={650}
              onClick={(r: any) => {
                const name = r.country ?? r.payload?.country;
                if (name) onCountry(name);
              }}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
  return (
    <ExplorerShell
      kind="patterns"
      title="Discover emission patterns"
      toolbar={
        <>
          <CountrySearch
            countries={boot.countries}
            country={country}
            onCountry={onCountry}
          />
          <Select
            name="Pattern method"
            value={family}
            onChange={(v) => {
              playback.onPlaying(false);
              F(v);
              if (v === 'hierarchical' && month > '2022-12') M('2022-12');
            }}
          >
            <option value="gmm">Gaussian mixture</option>
            <option value="kmeans">K-Means</option>
            <option value="hierarchical">Ward hierarchy</option>
          </Select>
          <Select name="Pattern month" value={month} onChange={M}>
            {periods.map((m) => (
              <option key={m} value={m}>
                {date(m)}
              </option>
            ))}
          </Select>
          <div className="aggregation-switch">
            {['globe', 'profiles'].map((v) => (
              <button key={v} aria-pressed={view === v} onClick={() => V(v)}>
                {v === 'globe' ? (
                  <Globe2 size={15} />
                ) : (
                  <ChartNoAxesCombined size={15} />
                )}
                <span>{v === 'globe' ? 'Globe' : 'Profiles'}</span>
              </button>
            ))}
          </div>
        </>
      }
      summary={
        <div className="summary-content">
          <span className="explorer-eyebrow">{methodName.toUpperCase()}</span>
          <h2>{country}: emission profile</h2>
          <p className="summary-period">
            {date(month)} · frozen reference model
          </p>
          <div
            className="summary-value group-value"
            key={country + month + family}
          >
            <small>Group</small>
            {current?.[family] ?? '-'}
          </div>
          <p className="summary-unit">
            {k} learned groups <span>in the study</span>
          </p>
          <div className="summary-facts">
            {family === 'gmm' ? (
              <>
                <strong>
                  {current ? n(current.gmm_probability * 100, 1) : '-'}%
                </strong>{' '}
                strongest membership
              </>
            ) : (
              <>
                <strong>
                  {n(boot.research.selected[family].silhouette, 3)}
                </strong>{' '}
                reference silhouette
              </>
            )}
          </div>
          <div className="summary-chart">
            <span className="chart-kicker">COUNTRY EMISSIONS OVER TIME</span>
            <TinyBars
              rows={profileHistory}
              selected={month}
              onSelect={M}
              reduced={reduced}
            />
          </div>
          <p className="summary-coverage">
            {family === 'hierarchical'
              ? 'Fitted reference rows only. Heights show published emissions.'
              : 'Group colours identify profiles. Membership is not accuracy.'}
          </p>
        </div>
      }
      points={points}
      country={country}
      onCountry={onCountry}
      periodLabel={date(month)}
      periods={periods}
      period={month}
      onPeriod={M}
      playback={playback}
      legend={Array.from({ length: k }, (_, i) => ({
        label: 'Group ' + i,
        color: palette[i % 6],
      }))}
      details={details(family, month, F, M)}
      alternative={view === 'profiles' ? scatter : undefined}
      error={error}
      busy={busy}
    />
  );
}
export function ForecastExplorer({
  boot,
  data,
  country,
  onCountry,
  details,
}: {
  boot: O;
  data: O;
  country: string;
  onCountry: (v: string) => void;
  details: (
    method: string,
    target: string,
    onMethod: (v: string) => void,
    onTarget: (v: string) => void,
  ) => ReactNode;
}) {
  const [method, M] = useState(data.selected),
    [target, T] = useState(
      data.future_months.includes('2027-01')
        ? '2027-01'
        : data.future_months[0],
    );
  const reduced = useReducedMotion();
  const periods: string[] = data.future_months;
  const { map, busy, error } = useMapData(
    `/explorer?mode=forecast&period=${target}&method=${method}`,
  );
  const row = data.method_forecasts[method]?.find((r: O) => r.month === target);
  const playback = usePlayback(periods, target, T);
  const series = [
    ...data.history
      .slice(-12)
      .map((r: O) => ({ period: r.month, value: r.observed, forecast: false })),
    ...data.method_forecasts[method].map((r: O) => ({
      period: r.month,
      value: r.predicted,
      forecast: true,
    })),
  ];
  const points = (map?.items || []).map((r: O) => ({
    country: r.country,
    total_co2: r.total_co2,
    color: sectorColour(r, 'all'),
  }));
  function downloadView() {
    if (!map) return;
    const rows = [
      ['country', 'month', 'method', 'forecast_co2_mt', ...keys],
      ...map.items.map((r: O) => [
        r.country,
        target,
        r.method,
        r.total_co2,
        ...keys.map((k) => r[k]),
      ]),
    ];
    const csv = rows
      .map((r) =>
        r
          .map((v: any) => '"' + String(v).replaceAll('"', '""') + '"')
          .join(','),
      )
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `CarbonScope_${target}_${method}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  if (!row)
    return (
      <div className="error">
        No supported future months remain. Refresh the source and documented
        forecast protocol.
      </div>
    );
  return (
    <ExplorerShell
      kind="future"
      title="Explore future estimates"
      toolbar={
        <>
          <CountrySearch
            countries={boot.countries}
            country={country}
            onCountry={onCountry}
          />
          <Select
            name="Forecast approach in explorer"
            value={method}
            onChange={M}
          >
            {Object.entries(data.methods).map(([key, label]) => (
              <option key={key} value={key}>
                {String(label)}
              </option>
            ))}
          </Select>
          <Select name="Forecast month in explorer" value={target} onChange={T}>
            {periods.map((m) => (
              <option key={m} value={m}>
                {date(m)}
              </option>
            ))}
          </Select>
          <button
            className="map-export"
            onClick={downloadView}
            disabled={!map}
            title="Download the displayed month and forecast approach"
          >
            <Download size={16} />
            <span>Export</span>
          </button>
        </>
      }
      summary={
        <div className="summary-content">
          <span className="explorer-eyebrow">MONTHLY FORECAST</span>
          <h2>{country}: all sectors</h2>
          <p className="summary-period">
            {date(target)} · {row.horizon} months beyond source data
          </p>
          <div className="summary-value" key={country + target + method}>
            {n(row.predicted)}
            <small>Mt</small>
          </div>
          <p className="summary-unit">
            CO₂ <span>estimated per month</span>
          </p>
          <div className="summary-facts">
            <strong>
              {n(row.lower)}–{n(row.upper)}
            </strong>{' '}
            Mt historical-error range
          </div>
          <div className="summary-chart">
            <span className="chart-kicker">
              HISTORY <i /> FORECAST
            </span>
            <TinyBars
              rows={series}
              selected={target}
              onSelect={(v) => {
                if (periods.includes(v)) T(v);
              }}
              reduced={reduced}
            />
          </div>
          <p className="summary-coverage">
            {data.methods[method]}
            <span>Indicative range; not a calibrated confidence interval.</span>
          </p>
        </div>
      }
      points={points}
      country={country}
      onCountry={onCountry}
      periodLabel={date(target) + ' · forecast'}
      periods={periods}
      period={target}
      onPeriod={T}
      playback={playback}
      legend={keys.map((k, i) => ({ label: names[k], color: palette[i] }))}
      details={details(method, target, M, T)}
      error={error}
      busy={busy}
    />
  );
}
