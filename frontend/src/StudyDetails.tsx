import { useEffect, useState } from 'react';
import { api } from './api';
import {
  TrendingUp,
  BookOpen,
  Download,
  ArrowUpRight,
  ChevronRight,
  Check,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Card,
  Tag,
  Formula,
  Stat,
  Trend,
  fmt,
  date,
  colors,
  sectorKeys,
  labels,
  explanation,
  type O,
} from './study-ui';
export function DatasetDetails({
  audit,
  country,
  history,
}: {
  audit: O;
  country: string;
  history: O[];
}) {
  return (
    <>
      <div className="stats">
        <Stat
          label="Coverage"
          value="2019–2026"
          note="Complete months through August 2026"
        />
        <Stat
          label="Monthly records"
          value={fmt(audit.monthly_rows, 0)}
          note={`${audit.countries} countries × ${audit.months} months`}
        />
        <Stat
          label="Missing / duplicate rows"
          value="0 / 0"
          note="Validated modelling table"
        />
        <Stat
          label="Imputed values"
          value="0"
          note="Real source zeros are preserved"
        />
      </div>
      <div className="grid">
        <Card
          title={`${country} · sector breakdown`}
          sub="Published estimates · monthly totals in Mt CO₂"
        >
          <Trend
            rows={history.slice(-36)}
            fields={sectorKeys.map((k) => ({ key: k, name: labels[k] }))}
          />
        </Card>
        <Card
          title="What was cleaned?"
          sub="Source data is checked, not disguised."
        >
          <ul className="check-list">
            {audit.cleaning.map((s: string) => (
              <li key={s}>
                <Check size={17} />
                <span>{s}</span>
              </li>
            ))}
          </ul>
          <div className="download-row">
            <a className="button" href="/api/download/monthly">
              <Download size={16} />
              Clean monthly CSV
            </a>
            <a className="button secondary" href="/api/download/daily">
              Clean daily CSV
            </a>
          </div>
          <p className="small muted">
            {fmt(audit.raw_rows, 0)} source rows → {fmt(audit.daily_rows, 0)}{' '}
            country-sector daily rows → {fmt(audit.monthly_rows, 0)} complete
            monthly records.
          </p>
        </Card>
      </div>
      <Card
        title="The data you download"
        sub={`${country} · latest 12 months · all figures in million tonnes CO₂`}
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                {sectorKeys.map((k) => (
                  <th key={k}>{labels[k]}</th>
                ))}
                <th>Six-sector total</th>
              </tr>
            </thead>
            <tbody>
              {history
                .slice(-12)
                .reverse()
                .map((r: O) => (
                  <tr key={r.month}>
                    <td>{date(r.month)}</td>
                    {sectorKeys.map((k) => (
                      <td key={k}>{fmt(r[k], 3)}</td>
                    ))}
                    <td>
                      <b>{fmt(r.observed, 3)}</b>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="source-note">
        <Info size={18} />
        <p>
          Source:{' '}
          <a href="https://carbonmonitor.org" target="_blank" rel="noreferrer">
            Carbon Monitor
          </a>
          . Published activity-based CO₂ estimates; not direct sensor
          measurements. Our total covers the six reported sectors, including
          international aviation, and is not an all-greenhouse-gas inventory.{' '}
          <a href="/api/download/audit">View data audit</a>.{' '}
          <a href="/api/download/quality">Data quality flags</a> ·{' '}
          <a href="/api/download/raw">Original source CSV</a>. Structural
          completeness does not prove every source estimate is correct.
        </p>
      </div>
    </>
  );
}

export function Patterns({
  boot,
  country,
  data,
  family: outerFamily,
  month: outerMonth,
  onFamilyChange,
  onMonthChange,
}: {
  boot: O;
  country: string;
  data?: O;
  family?: string;
  month?: string;
  onFamilyChange?: (v: string) => void;
  onMonthChange?: (v: string) => void;
}) {
  const [localFamily, LF] = useState('gmm'),
    [localMonth, LM] = useState('2026-08'),
    [points, S] = useState<O[]>([]),
    [error, E] = useState('');
  const family = outerFamily ?? localFamily,
    month = outerMonth ?? localMonth,
    F = onFamilyChange ?? LF,
    M = onMonthChange ?? LM;
  const r = boot.research;
  useEffect(() => {
    let active = true;
    S([]);
    E('');
    api(`/atlas?model=${family}&month=${month}`)
      .then((d) => active && S(d.items))
      .catch((e) => active && E(e.message));
    return () => {
      active = false;
    };
  }, [family, month]);
  const current = points.find((x) => x.country === country);
  return (
    <>
      <div className="toolbar">
        <label>
          Clustering method
          <select
            value={family}
            onChange={(e) => {
              F(e.target.value);
              if (e.target.value === 'hierarchical' && month > '2022-12')
                M('2022-12');
            }}
          >
            <option value="gmm">Gaussian Mixture</option>
            <option value="kmeans">K-Means</option>
            <option value="hierarchical">Hierarchical · reference only</option>
          </select>
        </label>
        <label>
          Observation month
          <select value={month} onChange={(e) => M(e.target.value)}>
            {boot.months
              .filter(
                (m: string) => family !== 'hierarchical' || m <= '2022-12',
              )
              .map((m: string) => (
                <option key={m} value={m}>
                  {date(m)}
                </option>
              ))}
          </select>
        </label>
        <Tag>{r.selected[family].k} learned groups</Tag>
        {current && (
          <Tag>
            {country} · Group {current[family]}
          </Tag>
        )}
      </div>
      {error && <div className="error">{error}</div>}
      <div className="grid wide">
        <Card
          title="A map of emission profiles"
          sub={`PCA projection · first two components retain ${fmt(r.pca.variance.slice(0, 2).reduce((a: number, b: number) => a + b, 0) * 100, 1)}% of reference variance. Hover over a country.`}
        >
          <ResponsiveContainer width="100%" height={360}>
            <ScatterChart margin={{ left: 5, bottom: 15, right: 20, top: 15 }}>
              <CartesianGrid strokeDasharray="3 5" stroke="#657071" />
              <XAxis
                type="number"
                dataKey="pc1"
                name="PC1"
                tickFormatter={(v) => fmt(v, 1)}
                label={{
                  value: 'Principal component 1',
                  position: 'insideBottom',
                  offset: -12,
                }}
              />
              <YAxis
                type="number"
                dataKey="pc2"
                name="PC2"
                tickFormatter={(v) => fmt(v, 1)}
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
              <Legend verticalAlign="top" />
              {Array.from({ length: r.selected[family].k }, (_, k) => (
                <Scatter
                  key={k}
                  name={`Group ${k}`}
                  data={points.filter((p) => p[family] === k)}
                  fill={colors[k % 6]}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
          <p className="small muted">
            These are similarity coordinates, not geographic locations. Group
            IDs are labels-not rankings-and differ between algorithms.
          </p>
        </Card>
        <Card title={explanation[family].title} sub="Your two-line explanation">
          <Formula
            formula={explanation[family].formula}
            text={explanation[family].text}
          />
          <h4 className="spaced">How to read this</h4>
          <p>
            Each dot is one country-month. Colours show its learned group;
            nearby points have similar positions in the projection.
          </p>
          {family === 'hierarchical' ? (
            <p className="small muted">
              Hierarchy only labels fitted 2019–2022 observations; it has no
              native prediction for new profiles.
            </p>
          ) : (
            <p className="small muted">
              The model stays fixed. Changing the month applies that same model
              to another period.
            </p>
          )}
          <div className="compact-list">
            {r.profiles[family].map((p: O) => (
              <div key={p.cluster}>
                <i style={{ background: colors[p.cluster % 6] }} />
                <span>Group {p.cluster}</span>
                <small>
                  {labels[p.dominant_sector]} leads · {p.count} reference rows
                </small>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card
        title="Country assignments"
        sub={`${date(month)} · select your country in the header`}
      >
        <div className="table-scroll bounded">
          <table>
            <thead>
              <tr>
                <th>Country</th>
                <th>Group</th>
                {family === 'gmm' && <th>Membership</th>}
                <th>Position · PC1</th>
                <th>Position · PC2</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr
                  className={p.country === country ? 'highlight' : ''}
                  key={p.country}
                >
                  <td>{p.country}</td>
                  <td>
                    <span
                      className="group-dot"
                      style={{ background: colors[p[family] % 6] }}
                    />
                    Group {p[family]}
                  </td>
                  {family === 'gmm' && (
                    <td>{fmt(p.gmm_probability * 100, 1)}%</td>
                  )}
                  <td>{fmt(p.pc1)}</td>
                  <td>{fmt(p.pc2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {data && <Profile key={country} data={data} />}
    </>
  );
}
function Profile({ data }: { data: O }) {
  const init = Object.fromEntries(
    sectorKeys.map((k) => [k, data.history.at(-1)[k]]),
  );
  const [v, V] = useState<O>(init),
    [method, M] = useState('gmm'),
    [result, R] = useState<O>(),
    [error, E] = useState(''),
    [busy, B] = useState(false);
  async function run() {
    B(true);
    R(undefined);
    E('');
    try {
      if (Object.values(v).some((x) => x === '' || !Number.isFinite(Number(x))))
        throw Error('Enter all six values.');
      R(
        await api('/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: method,
            values: Object.fromEntries(
              Object.entries(v).map(([k, x]) => [k, Number(x)]),
            ),
          }),
        }),
      );
    } catch (e) {
      E((e as Error).message);
    } finally {
      B(false);
    }
  }
  return (
    <Card
      title="Try a measured profile"
      sub="Optional live model demo · values are monthly sector emissions in Mt CO₂"
    >
      <details>
        <summary>Open profile analysis</summary>
        <div className="grid">
          <div>
            <label>
              Method
              <select
                value={method}
                onChange={(e) => {
                  M(e.target.value);
                  R(undefined);
                }}
              >
                <option value="gmm">GMM · membership probabilities</option>
                <option value="kmeans">K-Means · nearest centre</option>
              </select>
            </label>
            <div className="input-grid">
              {sectorKeys.map((k) => (
                <label key={k}>
                  {labels[k]}
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={v[k]}
                    onChange={(e) => {
                      V({ ...v, [k]: e.target.value });
                      R(undefined);
                    }}
                  />
                </label>
              ))}
            </div>
            <button onClick={run} disabled={busy}>
              {busy ? 'Analysing…' : 'Analyse profile'}
              <ArrowUpRight size={16} />
            </button>
            <p className="small muted">
              Preloaded: {data.country}, August 2026. This assigns a profile;
              future emissions are on the Forecast page.
            </p>
          </div>
          <div>
            {error && <p className="error">{error}</p>}
            {result ? (
              <>
                <h2>Group {result.cluster}</h2>
                {result.probabilities.map((p: number, k: number) => (
                  <div className="probability" key={k}>
                    <span>Group {k}</span>
                    <div>
                      <i
                        style={{
                          width: `${p * 100}%`,
                          background: colors[k % 6],
                        }}
                      />
                    </div>
                    <b>{fmt(p * 100, 1)}%</b>
                  </div>
                ))}
                <p className="small muted">
                  {result.outside_reference
                    ? 'One or more inputs exceed reference ranges. Interpret cautiously.'
                    : 'Inputs are within reference feature ranges.'}{' '}
                  Membership is not an accuracy score.
                </p>
              </>
            ) : (
              <p className="muted">
                Run the saved model to see your profile assignment.
              </p>
            )}
          </div>
        </div>
      </details>
    </Card>
  );
}
export function Models({ research: r, data }: { research: O; data?: O }) {
  const [tab, T] = useState('Clustering');
  const selected = Object.values(r.selected) as O[];
  return (
    <>
      <div className="tabs">
        {['Clustering', 'PCA & factors', 'Forecast comparison'].map((t) => (
          <button
            className={tab === t ? 'active' : ''}
            key={t}
            onClick={() => T(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Clustering' && (
        <>
          <div className="grid three">
            {selected.map((s) => (
              <Card
                key={s.family}
                title={explanation[s.family].title}
                sub={`${s.k} groups · selected on reference data`}
              >
                <div className="score">
                  {fmt(s.silhouette, 3)}
                  <span>Silhouette · higher is better</span>
                </div>
                <dl>
                  <dt>Davies–Bouldin ↓</dt>
                  <dd>{fmt(s.davies_bouldin, 3)}</dd>
                  <dt>Calinski–Harabasz ↑</dt>
                  <dd>{fmt(s.calinski_harabasz, 0)}</dd>
                  <dt>Stability ARI ↑</dt>
                  <dd>{fmt(s.stability_ari, 3)}</dd>
                  <dt>Fit time</dt>
                  <dd>{fmt(s.seconds, 2)} s</dd>
                </dl>
                <Formula
                  formula={explanation[s.family].formula}
                  text={explanation[s.family].text}
                />
              </Card>
            ))}
          </div>
          <div className="grid">
            <Card
              title="Cluster separation"
              sub="Same reference features · silhouette is not classification accuracy"
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={selected}>
                  <CartesianGrid vertical={false} strokeDasharray="3 5" />
                  <XAxis dataKey="family" />
                  <YAxis domain={[-0.1, 1]} />
                  <Tooltip />
                  <Bar
                    dataKey="silhouette"
                    name="Silhouette score"
                    radius={[6, 6, 0, 0]}
                  >
                    {selected.map((_, i) => (
                      <Cell key={i} fill={colors[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <Formula
                formula="s(i) = [b(i) − a(i)] / max[a(i), b(i)]"
                text="a: mean distance within the same group. b: nearest other-group mean distance. Higher scores suggest better separation."
              />
            </Card>
            <Card
              title="K-Means · choosing the cluster count"
              sub="Elbow curve · squared distances within groups"
            >
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={r.runs.filter((x: O) => x.family === 'kmeans')}
                >
                  <CartesianGrid strokeDasharray="3 5" />
                  <XAxis
                    dataKey="k"
                    label={{
                      value: 'Number of groups (k)',
                      position: 'insideBottom',
                      offset: -4,
                    }}
                  />
                  <YAxis width={65} />
                  <Tooltip />
                  <Line
                    dataKey="inertia"
                    name="Within-cluster sum of squares"
                    stroke={colors[0]}
                    strokeWidth={2.5}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="small muted">
                The curve helps explain k. Final K-Means selection uses the
                highest reference silhouette among k = 2–6.
              </p>
            </Card>
          </div>
          <div className="grid">
            <Card
              title="GMM · model complexity"
              sub="Lower BIC is preferred within GMM; it is not comparable to K-Means"
            >
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={Array.from({ length: 5 }, (_, i) => ({
                    k: i + 2,
                    diag: r.runs.find(
                      (x: O) =>
                        x.family === 'gmm' &&
                        x.k === i + 2 &&
                        x.covariance === 'diag',
                    )?.bic,
                    full: r.runs.find(
                      (x: O) =>
                        x.family === 'gmm' &&
                        x.k === i + 2 &&
                        x.covariance === 'full',
                    )?.bic,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 5" />
                  <XAxis dataKey="k" />
                  <YAxis width={75} domain={['auto', 'auto']} />
                  <Tooltip />
                  <Legend />
                  <Line
                    dataKey="diag"
                    name="Diagonal covariance"
                    stroke={colors[0]}
                  />
                  <Line
                    dataKey="full"
                    name="Full covariance"
                    stroke={colors[1]}
                  />
                </LineChart>
              </ResponsiveContainer>
              <Formula
                formula="BIC = p ln(n) − 2 ln(L̂)"
                text="Balances fit and complexity. p is the number of fitted parameters; n is the number of observations."
              />
            </Card>
            <Card
              title="EM · learning step by step"
              sub={`${r.selected.gmm.iterations} iterations · actual selected GMM fitting history`}
            >
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={r.em.map((v: number, i: number) => ({
                    iteration: i + 1,
                    value: v,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 5" />
                  <XAxis dataKey="iteration" />
                  <YAxis
                    domain={['auto', 'auto']}
                    width={65}
                    tickFormatter={(v) => fmt(v, 2)}
                  />
                  <Tooltip />
                  <Line
                    dataKey="value"
                    name="Average log-likelihood lower bound"
                    stroke={colors[0]}
                    dot={false}
                    strokeWidth={2.5}
                  />
                </LineChart>
              </ResponsiveContainer>
              <Formula
                formula="E: estimate memberships → M: update parameters"
                text="EM trains the mixture model; it is not a separate clustering competitor. A flattening curve indicates convergence."
              />
            </Card>
          </div>
          <Card
            title="Hierarchical dendrogram"
            sub="Ward linkage · 60 reference rows shown for readability; the fitted model uses all reference rows"
          >
            <svg
              className="dendrogram"
              viewBox="0 0 900 220"
              role="img"
              aria-label="Hierarchical clustering dendrogram"
            >
              {r.dendrogram.icoord.map((xs: number[], i: number) => {
                const max = Math.max(...r.dendrogram.dcoord.flat());
                return (
                  <polyline
                    key={i}
                    points={xs
                      .map(
                        (x, j) =>
                          `${(x / 600) * 880 + 10},${200 - (r.dendrogram.dcoord[i][j] / max) * 185}`,
                      )
                      .join(' ')}
                    fill="none"
                    stroke="#f39865"
                    strokeWidth="1.5"
                  />
                );
              })}
            </svg>
          </Card>
          <Card
            title="Distance and linkage comparison"
            sub="Same group count. All reported silhouette scores use Euclidean distance for a common evaluation."
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Hierarchy configuration</th>
                    <th>Silhouette ↑</th>
                    <th>Davies–Bouldin ↓</th>
                  </tr>
                </thead>
                <tbody>
                  {r.distance_comparison.map((x: O) => (
                    <tr key={x.name}>
                      <td>{x.name}</td>
                      <td>{fmt(x.silhouette, 3)}</td>
                      <td>{fmt(x.davies_bouldin, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Formula
              formula="Euclidean: √Σ(xⱼ−yⱼ)²    ·    Manhattan: Σ|xⱼ−yⱼ|"
              text="Different distances express similarity differently. Ward linkage specifically requires Euclidean geometry."
            />
          </Card>
          <details className="card">
            <summary>Experiment registry & chronological evaluation</summary>
            <p>{r.selection}</p>
            <p>
              Reference {r.reference}: {r.counts.train} rows. Development{' '}
              {r.development}: {r.counts.development}. Held-out {r.test}:{' '}
              {r.counts.test}. Stability uses three 80%-country subsets; ARI
              measures agreement, not accuracy.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Run</th>
                    <th>Reference silhouette</th>
                    <th>Selected</th>
                  </tr>
                </thead>
                <tbody>
                  {r.runs.map((x: O) => (
                    <tr key={x.id}>
                      <td>{x.id}</td>
                      <td>{fmt(x.silhouette, 3)}</td>
                      <td>{x.selected ? 'Yes' : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <a href="/api/download/research">Download full comparison</a>
          </details>
        </>
      )}
      {tab === 'PCA & factors' && (
        <>
          <div className="grid">
            {['pca', 'factor'].map((k) => (
              <Card
                key={k}
                title={explanation[k].title}
                sub="Two dimensions for a matched comparison"
              >
                <Formula
                  formula={explanation[k].formula}
                  text={explanation[k].text}
                />
              </Card>
            ))}
          </div>
          <div className="grid">
            <Card
              title="How much information does PCA retain?"
              sub={`${r.pca.dimensions_90} components reach at least 90% of reference variance`}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={r.pca.variance.map((v: number, i: number) => ({
                    name: 'PC' + (i + 1),
                    variance: v * 100,
                  }))}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 5" />
                  <XAxis dataKey="name" />
                  <YAxis unit="%" />
                  <Tooltip formatter={(v: any) => fmt(v, 1) + '%'} />
                  <Bar
                    dataKey="variance"
                    name="Explained variance"
                    fill={colors[0]}
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card
              title="Choosing latent dimensions"
              sub="Held-out reconstruction error · lower is better for this particular objective"
            >
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={r.reduction_comparison}>
                  <CartesianGrid strokeDasharray="3 5" />
                  <XAxis dataKey="dimensions" />
                  <YAxis tickFormatter={(v) => fmt(v, 2)} />
                  <Tooltip />
                  <Legend />
                  <Line
                    dataKey="pca_test_mse"
                    name="PCA MSE"
                    stroke={colors[0]}
                  />
                  <Line
                    dataKey="factor_test_mse"
                    name="Factor Analysis MSE"
                    stroke={colors[1]}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="small muted">
                PCA minimises reconstruction error; Factor Analysis models
                shared variation plus noise. Lower MSE alone does not make one
                universally better.
              </p>
            </Card>
          </div>
          <Card
            title="Factor loadings · which sectors move together?"
            sub="Magnitude shows association; sign shows direction within each factor. Signs can flip without changing the model."
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Sector</th>
                    <th>Factor 1</th>
                    <th>Factor 2</th>
                    <th>Specific noise variance</th>
                  </tr>
                </thead>
                <tbody>
                  {sectorKeys.map((k, i) => (
                    <tr key={k}>
                      <td>{labels[k]}</td>
                      {[0, 1].map((j) => (
                        <td key={j}>
                          <span
                            className="heat-cell"
                            style={{
                              background:
                                r.factor.loadings[j][i] >= 0
                                  ? `rgba(19,134,117,${0.08 + Math.min(Math.abs(r.factor.loadings[j][i]), 1) * 0.28})`
                                  : `rgba(231,163,68,${0.08 + Math.min(Math.abs(r.factor.loadings[j][i]), 1) * 0.28})`,
                            }}
                          >
                            {fmt(r.factor.loadings[j][i], 3)}
                          </span>
                        </td>
                      ))}
                      <td>{fmt(r.factor.noise_variance[i], 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      {tab === 'Forecast comparison' && data && (
        <ForecastComparison data={data} method={data.selected} />
      )}
    </>
  );
}
function ForecastComparison({ data, method }: { data: O; method: string }) {
  const items = Object.entries(data.evaluation).map(
    ([id, e]: [string, any]) => ({
      id,
      name: data.methods[id],
      validation: e.validation.metrics.mae,
      test: e.test.metrics.mae,
      rmse: e.test.metrics.rmse,
      smape: e.test.metrics.smape,
    }),
  );
  const chosen = items.find((x) => x.id === method)!;
  return (
    <>
      <Card
        title={`${data.country} · do Unit 3 features help forecasting?`}
        sub="Same Ridge regression, same time splits. Sector history controls for information added by the learned representations."
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Forecasting approach</th>
                <th>Validation MAE ↓</th>
                <th>Test MAE ↓</th>
                <th>Test RMSE ↓</th>
                <th>Test sMAPE ↓</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id} className={x.id === method ? 'highlight' : ''}>
                  <td>
                    {x.name}
                    {x.id === data.selected && (
                      <span className="tiny-tag">Validation choice</span>
                    )}
                  </td>
                  <td>{fmt(x.validation, 3)}</td>
                  <td>{fmt(x.test, 3)}</td>
                  <td>{fmt(x.rmse, 3)}</td>
                  <td>{fmt(x.smape, 1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          Errors are in Mt CO₂, except sMAPE. The selected approach is chosen by
          validation-not by the later test scores. Baselines are allowed to win.
        </p>
      </Card>
      <div className="grid">
        <Card
          title="Final-test forecast error"
          sub="Lower MAE means a smaller average prediction error"
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={items}
              layout="vertical"
              margin={{ left: 0, right: 20 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 5" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="id" width={85} />
              <Tooltip formatter={(v: any) => fmt(v, 3) + ' Mt'} />
              <Bar dataKey="test" name="Test MAE" radius={[0, 5, 5, 0]}>
                {items.map((x, i) => (
                  <Cell
                    key={x.id}
                    fill={x.id === method ? colors[0] : '#9eb9c3'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card
          title="Explain the evaluation"
          sub={`${chosen.name} · ${data.evaluation[method].test.metrics.n} held-out predictions`}
        >
          <Formula
            formula="MAE = (1/n) Σ |y − ŷ|"
            text="Average absolute gap between the published value and the forecast. Lower is better; this is not an accuracy percentage."
          />
          <Formula
            formula="RMSE = √[(1/n) Σ(y − ŷ)²]"
            text="Penalises large misses more heavily. Both metrics use later observations unseen at each forecast origin."
          />
          <details>
            <summary>View time splits</summary>
            <p>
              Validation origins: {data.validation_origins.map(date).join(', ')}
              .
            </p>
            <p>
              Test origins: {data.test_origins.map(date).join(', ')}. Each
              forecasts 1–12 months ahead. Windows overlap, so errors are not
              independent samples.
            </p>
            <p>{data.protocol}</p>
            <p>{data.revision_note}</p>
          </details>
        </Card>
      </div>
    </>
  );
}
export function Forecast({
  data,
  country,
  controlledMethod,
  controlledTarget,
  onMethodChange,
  onTargetChange,
}: {
  data: O;
  country: string;
  controlledMethod?: string;
  controlledTarget?: string;
  onMethodChange?: (v: string) => void;
  onTargetChange?: (v: string) => void;
}) {
  const [localMethod, LM] = useState(data.selected),
    [localTarget, LT] = useState(
      data.future_months.includes('2027-01')
        ? '2027-01'
        : data.future_months[0],
    ),
    [evidence, E] = useState(false);
  const method = controlledMethod ?? localMethod,
    target = controlledTarget ?? localTarget,
    M = onMethodChange ?? LM,
    T = onTargetChange ?? LT;
  const future = data.method_forecasts[method],
    result = future.find((r: O) => r.month === target);
  if (!result)
    return (
      <div className="error">
        No supported future months remain. Update the source and retrain before
        presenting new forecasts.
      </div>
    );
  const rows = [
    ...data.history.slice(-24).map((r: O, i: number, a: O[]) => ({
      month: r.month,
      observed: r.observed,
      predicted: i === a.length - 1 ? r.observed : null,
    })),
    ...future.filter((r: O) => r.month <= target),
  ];
  const sector = sectorKeys
    .map((k) => ({ name: labels[k], value: result.sectors[k], key: k }))
    .sort((a, b) => b.value - a.value);
  const baseline = data.evaluation.seasonal.test.metrics.mae,
    modelerror = data.evaluation[method].test.metrics.mae;
  function download() {
    const header = [
      'country',
      'month',
      'status',
      'method',
      'forecast_co2_mt',
      'indicative_lower_mt',
      'indicative_upper_mt',
      'source_review_required',
      'extrapolation_review_required',
      ...sectorKeys,
    ];
    const entries = future
      .filter((r: O) => r.month <= target)
      .map((r: O) => [
        country,
        r.month,
        r.month > data.current_month
          ? 'future_forecast'
          : 'unobserved_month_estimate',
        method,
        r.predicted,
        r.lower,
        r.upper,
        Boolean(data.data_warnings?.length),
        Boolean(r.warnings?.length),
        ...sectorKeys.map((k) => r.sectors[k]),
      ]);
    const blob = new Blob(
      [[header, ...entries].map((r) => r.join(',')).join('\n')],
      { type: 'text/csv' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CarbonScope_${country.replaceAll(' ', '_')}_${target}_forecast.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const bridge = future
    .filter((r: O) => r.month <= data.current_month)
    .map((r: O) => date(r.month))
    .join(', ');
  return (
    <>
      <div className="toolbar">
        <label>
          Future month
          <select value={target} onChange={(e) => T(e.target.value)}>
            {data.future_months.map((m: string) => (
              <option value={m} key={m}>
                {date(m)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Forecast approach
          <select value={method} onChange={(e) => M(e.target.value)}>
            {Object.entries(data.methods).map(([k, v]) => (
              <option key={k} value={k}>
                {String(v)}
                {k === data.selected ? ' · validation choice' : ''}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary" onClick={download}>
          <Download size={16} />
          Download forecast
        </button>
      </div>
      {result.warnings?.length > 0 && (
        <div className="review-warning" role="alert">
          <b>Large extrapolation: interpret cautiously.</b>{' '}
          {result.warnings.join(' ')} The historical-error range is not a
          calibrated confidence interval.
        </div>
      )}
      <div className="forecast-banner">
        <div>
          <span className="eyebrow">
            {country.toUpperCase()} · {date(target).toUpperCase()}
          </span>
          <h2>
            {fmt(result.predicted)} <small>Mt CO₂</small>
          </h2>
          <p>Estimated monthly total across six sectors</p>
        </div>
        <div className="forecast-meta">
          <Tag>{data.methods[method]}</Tag>
          <p>{result.horizon} months beyond the last published data</p>
          <small>
            Historical-error range: {fmt(result.lower)}–{fmt(result.upper)} Mt
          </small>
        </div>
      </div>
      <div className="grid wide">
        <Card
          title="From published history to future estimates"
          sub="Solid = published source data · dashed = forecast · Mt CO₂ per month"
        >
          <Trend
            rows={rows}
            fields={[
              {
                key: 'observed',
                name: 'Published emissions',
                color: '#81cad1',
              },
              {
                key: 'predicted',
                name: 'Forecast',
                color: colors[0],
                dashed: true,
              },
              {
                key: 'lower',
                name: 'Indicative lower bound',
                color: '#a5b3ae',
                dashed: true,
              },
              {
                key: 'upper',
                name: 'Indicative upper bound',
                color: '#c1c9c3',
                dashed: true,
              },
            ]}
            height={330}
          />
          <p className="small muted">
            Published data ends August 2026. {bridge} are estimates, not
            observations. The error range is indicative-not a calibrated
            confidence interval.
          </p>
        </Card>
        <Card
          title="Where might emissions come from?"
          sub={`${date(target)} · predicted sector contributions`}
        >
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={sector}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
              >
                {sector.map((s, i) => (
                  <Cell key={s.key} fill={colors[i]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => fmt(v) + ' Mt'} />
            </PieChart>
          </ResponsiveContainer>
          <div className="compact-list">
            {sector.map((s, i) => (
              <div key={s.key}>
                <i style={{ background: colors[i] }} />
                <span>{s.name}</span>
                <b>{fmt(s.value)} Mt</b>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="insight">
        <TrendingUp size={22} />
        <p>
          <b>What can we learn?</b> {sector[0].name} has the largest predicted
          contribution for {date(target)}. Use this to identify a sector for
          closer monitoring-not to claim a causal policy effect.
        </p>
      </div>
      <div className="grid">
        <Card
          title="How this forecast is made"
          sub="One short explanation for your review"
        >
          <Formula
            formula={
              method === 'seasonal'
                ? 'ŷₜ = yₜ₋₁₂'
                : method === 'persistence'
                  ? 'ŷₜ₊ₕ = yₜ'
                  : 'β̂ = argminβ [Σ‖y − Xβ‖² + α‖β‖²]'
            }
            text={
              method === 'seasonal'
                ? 'Seasonal baseline: use the published emissions from the same month last year. No unknown future inputs are used.'
                : method === 'persistence'
                  ? 'Persistence baseline: carry the last published month forward. It is shown honestly when it outperforms more complex methods on validation.'
                  : 'Ridge predicts each sector from past emissions and known calendar seasonality. The chosen Unit 3 representation adds information about the past sector profile.'
            }
          />
          <p className="small muted">
            {method === 'history'
              ? 'History-only Ridge uses past total emissions and seasonality.'
              : method === 'sectors'
                ? 'Sector-history Ridge additionally uses the six log-transformed sector values at the forecast origin.'
                : method in explanation
                  ? explanation[method].text
                  : ''}{' '}
            Regression fits separately for each forecast horizon; it does not
            feed invented intermediate observations back into the model.
          </p>
        </Card>
        <Card
          title="Model evidence, at a glance"
          sub="Future accuracy is unknown; these errors come from historical testing."
        >
          <dl>
            <dt>Validation MAE</dt>
            <dd>{fmt(data.evaluation[method].validation.metrics.mae)} Mt</dd>
            <dt>Final-test MAE</dt>
            <dd>{fmt(modelerror)} Mt</dd>
            <dt>Seasonal baseline test MAE</dt>
            <dd>{fmt(baseline)} Mt</dd>
            <dt>Predicted profile</dt>
            <dd>GMM group {result.profile_cluster}</dd>
          </dl>
          <p className="small muted">
            {modelerror < baseline
              ? 'This approach beat the seasonal baseline on held-out MAE.'
              : method === 'seasonal'
                ? 'You are viewing the seasonal baseline.'
                : 'This approach did not beat the seasonal baseline on held-out MAE.'}{' '}
            A predicted group is a profile assignment, not a probability of a
            future event.
          </p>
          <button className="text-button" onClick={() => E(!evidence)}>
            {evidence ? 'Hide' : 'Show'} full model comparison{' '}
            <ChevronRight size={16} />
          </button>
        </Card>
      </div>
      {evidence && <ForecastComparison data={data} method={method} />}
      <details className="card">
        <summary>Forecast values & historical test predictions</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Estimate (Mt)</th>
                <th>Indicative range</th>
                <th>Status / review</th>
              </tr>
            </thead>
            <tbody>
              {future
                .filter((r: O) => r.month <= target)
                .map((r: O) => (
                  <tr key={r.month}>
                    <td>{date(r.month)}</td>
                    <td>{fmt(r.predicted)}</td>
                    <td>
                      {fmt(r.lower)}–{fmt(r.upper)}
                    </td>
                    <td>
                      {r.month > data.current_month
                        ? 'Future forecast'
                        : 'Unobserved-month estimate'}
                      {r.warnings?.length > 0 ? ' · large extrapolation' : ''}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <h4>Last test origin: August 2025</h4>
        <Trend
          rows={data.evaluation[method].test.rows.filter(
            (r: O) => r.origin === '2025-08',
          )}
          fields={[
            { key: 'actual', name: 'Published actual' },
            { key: 'predicted', name: 'Historical forecast', dashed: true },
          ]}
        />
        <p className="small muted">
          {data.interval_note} Forecasts are exploratory and can miss policy,
          economic or energy shocks.
        </p>
      </details>
    </>
  );
}
export function Guide({ audit, research }: { audit: O; research: O }) {
  return (
    <>
      <div className="guide-intro">
        <BookOpen size={28} />
        <div>
          <h2>Your review, in six stops.</h2>
          <p>Keep these notes open when you need a quick reminder.</p>
        </div>
        <a href="/api/download/guide" className="button secondary">
          <Download size={16} />
          Speaking notes
        </a>
      </div>
      <div className="grid">
        {[
          [
            '01',
            'Problem & purpose',
            'We compare Unit 3 methods to understand country emission patterns, then test whether those patterns improve future monthly forecasts.',
          ],
          [
            '02',
            'Real data & cleaning',
            `Carbon Monitor daily estimates through 31 August 2026. We use ${audit.countries} countries, six sectors and ${fmt(audit.monthly_rows, 0)} complete monthly rows-without filling missing values.`,
          ],
          [
            '03',
            'Clustering comparison',
            'K-Means gives hard groups; GMM gives soft memberships and is trained with EM; hierarchy shows how profiles merge. We compare separation, stability and runtime.',
          ],
          [
            '04',
            'PCA & Factor Analysis',
            'PCA retains maximum variance; Factor Analysis models shared factors plus noise. We compare equal dimensions, reconstruction and their use in forecasting.',
          ],
          [
            '05',
            'Future prediction',
            'Past emissions and calendar seasonality predict future sector totals. We compare history-only Ridge, Unit 3 features and simple baselines using chronological testing.',
          ],
          [
            '06',
            'Useful result & limitation',
            'The forecast identifies expected emissions and leading sectors for monitoring. These are estimates, and a complex model is not guaranteed to beat a baseline.',
          ],
        ].map(([n, t, s]) => (
          <Card title={t} sub={`STEP ${n}`} key={n}>
            <p className="speaking">{s}</p>
          </Card>
        ))}
      </div>
      <Card
        title="Quick questions your professor may ask"
        sub="Short, defensible answers"
      >
        <div className="qa">
          <div>
            <b>Are these values real?</b>
            <p>
              The historical records are published Carbon Monitor estimates. Our
              future predictions are separately labelled.
            </p>
          </div>
          <div>
            <b>Where are September–November 2026?</b>
            <p>
              The latest downloaded records end in August. Later months are
              unobserved estimates; we do not present them as measured data.
            </p>
          </div>
          <div>
            <b>Why no accuracy percentage?</b>
            <p>
              Clustering has no known true group labels. We use silhouette and
              stability; forecasting uses MAE, RMSE and sMAPE.
            </p>
          </div>
          <div>
            <b>Which model is best?</b>
            <p>
              It depends on the task and country. We report the measured
              comparison; validation selects the forecast approach, and a later
              test checks it.
            </p>
          </div>
          <div>
            <b>Why are some forecasts flat?</b>
            <p>
              The persistence baseline repeats the last observed month. It
              remains a valid comparison and is selected when it wins
              validation.
            </p>
          </div>
          <div>
            <b>Why compare GMM with EM?</b>
            <p>
              We do not treat them as competitors. EM is the fitting procedure
              inside GMM.
            </p>
          </div>
          <div>
            <b>What prevents data leakage?</b>
            <p>
              Unit 3 transforms are frozen at December 2022. Every regression
              uses only data available at its forecast origin; test results
              never select the model.
            </p>
          </div>
          <div>
            <b>Can I download the exact modelling data?</b>
            <p>
              Yes. The clean monthly CSV contains the same complete rows used in
              the analysis, with no empty fields.
            </p>
          </div>
        </div>
      </Card>
      <details className="card">
        <summary>Formula reference</summary>
        {Object.entries(explanation).map(([k, x]) => (
          <Formula key={k} formula={x.formula} text={x.text} />
        ))}
        <Formula
          formula="z = [log(1+x) − μtrain] / σtrain"
          text="Reduce skew, then scale using training statistics only."
        />
        <Formula
          formula="DBI = (1/K) Σᵢ maxⱼ≠ᵢ [(Sᵢ+Sⱼ)/Mᵢⱼ]"
          text="Average worst overlap between groups: S is within-group spread and M is centre separation. Lower is better."
        />
        <Formula
          formula="CH = [tr(B)/(K−1)] / [tr(W)/(n−K)]"
          text="Between-group dispersion relative to within-group dispersion. Higher is better within the same dataset."
        />
        <Formula
          formula="ARI = (RI − expected RI) / (maximum RI − expected RI)"
          text="Chance-adjusted agreement between two groupings. Used here to assess country-subsample stability."
        />
        <Formula
          formula="MAE = mean(|y−ŷ|) · RMSE = √mean((y−ŷ)²)"
          text="Forecast errors; lower is better. sMAPE = mean(2|y−ŷ| / (|y|+|ŷ|)) × 100."
        />
        <p className="small muted">
          PCA needs {research.pca.dimensions_90} dimensions to retain at least
          90% of reference variance. Clustering operates in the six-dimensional
          transformed feature space.
        </p>
      </details>
    </>
  );
}
