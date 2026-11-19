import { Card, Stat, Trend, fmt, sectorKeys, labels, type O } from './study-ui';
import {
  DatasetDetails,
  Patterns,
  Models,
  Forecast,
  Guide,
} from './StudyDetails';
import { api } from './api';
import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Database,
  Layers3,
  TrendingUp,
  Download,
  ArrowUpRight,
  X,
  Activity,
  ArrowRight,
  ChevronDown,
  Home,
  Globe2,
} from 'lucide-react';
import '@fontsource-variable/inter';
import './style.css';
import './explorers.css';
import {
  CountryExplorer,
  PatternsExplorer,
  ForecastExplorer,
} from './Explorers';
import type { GlobePoint } from './Globe';
const Globe = lazy(() => import('./Globe'));
const featureDescriptions: O = {
  'Clean dataset': {
    title: 'Explore country emissions',
    text: 'Inspect six sectors, compare monthly histories, and download the exact data behind the study.',
    icon: Database,
  },
  'Emission patterns': {
    title: 'Discover emission patterns',
    text: 'Explore country profiles through K-Means, Gaussian mixtures and hierarchical clustering.',
    icon: Layers3,
  },
  'Future forecast': {
    title: 'Explore future estimates',
    text: 'Compare eight forecasting approaches, sector contributions and the evidence behind each estimate.',
    icon: TrendingUp,
  },
};
function FeatureMenu({
  go,
  close,
}: {
  go: (page: string) => void;
  close: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
      if (e.key === 'Tab') {
        const nodes = panel.current?.querySelectorAll<HTMLElement>(
          'button,a[href],select',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, []);
  return (
    <div className="menu-backdrop">
      <div
        id="feature-menu"
        ref={panel}
        className="feature-menu"
        role="dialog"
        aria-modal="true"
        aria-label="CarbonScope navigation"
      >
        <div className="menu-top">
          <button
            className="wordmark"
            onClick={close}
            aria-label="Close CarbonScope navigation"
          >
            CARBONSCOPE
            <span className="caret open">
              <ChevronDown size={17} />
            </span>
          </button>
          <div className="menu-home">
            <button onClick={() => go('Overview')}>
              <span className="circle-icon small-circle">
                <Home size={17} />
              </span>
              Home
            </button>
            <button className="menu-close" onClick={close}>
              Close <X size={19} />
            </button>
          </div>
        </div>
        <div className="menu-body">
          <nav className="menu-main" aria-label="Features">
            <div className="menu-feature-grid">
              {Object.entries(featureDescriptions).map(([page, item]) => {
                const Icon = item.icon;
                return (
                  <button
                    key={page}
                    className="feature-card"
                    onClick={() => go(page)}
                  >
                    <span className="circle-icon">
                      <Icon size={25} />
                    </span>
                    <h2>{item.title}</h2>
                    <p>{item.text}</p>
                    <span className="feature-card-bottom">
                      {page === 'Clean dataset'
                        ? '36 countries · 6 sectors'
                        : page === 'Emission patterns'
                          ? 'Clustering · PCA · Factor Analysis'
                          : 'Historical tests · monthly estimates'}
                      <ArrowUpRight size={21} />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="menu-lower">
              <div className="menu-download">
                <span className="circle-icon">
                  <Download size={24} />
                </span>
                <h2>Data downloads</h2>
                <p>
                  Original source records, cleaned datasets and transparent
                  research reports.
                </p>
                <a className="light-button" href="/api/download/monthly">
                  Download monthly data <ArrowDownIcon />
                </a>
                <div className="download-links">
                  <a href="/api/download/raw">Original source</a>
                  <a href="/api/download/daily">Daily dataset</a>
                  <a href="/api/download/quality">Quality flags</a>
                </div>
              </div>
              <div className="menu-link-column">
                <span className="eyebrow">COMPARE THE METHODS</span>
                <button onClick={() => go('Model comparison')}>
                  Model comparison <ArrowUpRight size={17} />
                </button>
                <button onClick={() => go('Emission patterns')}>
                  Country profiles
                </button>
                <a href="/api/download/research">Research results</a>
                <a href="/api/download/audit">Source & data audit</a>
              </div>
              <div className="menu-link-column">
                <span className="eyebrow">ABOUT THE PROJECT</span>
                <button onClick={() => go('Presentation guide')}>
                  Presentation guide <ArrowUpRight size={17} />
                </button>
                <a href="/api/download/guide">Speaking notes</a>
                <a
                  href="https://carbonmonitor.org"
                  target="_blank"
                  rel="noreferrer"
                >
                  Carbon Monitor source ↗
                </a>
                <span className="menu-footnote">
                  Unit 3 research
                  <br />
                  Patterns to prediction.
                </span>
              </div>
            </div>
          </nav>
          <aside className="menu-snapshot">
            <span className="eyebrow">THE CURRENT SNAPSHOT</span>
            <h2>
              Evidence first.
              <br />
              Always.
            </h2>
            <div className="snapshot-art" aria-hidden="true">
              <div className="snapshot-sphere" />
              <span>CO₂</span>
            </div>
            <span className="eyebrow orange">JAN 2019 - AUG 2026</span>
            <h3>
              A world of patterns.
              <br />
              One shared dataset.
            </h3>
            <p>
              36 countries. Six sectors. Published Carbon Monitor estimates,
              with source review flags kept visible.
            </p>
            <button
              className="light-button"
              onClick={() => go('Presentation guide')}
            >
              Meet the project <ArrowRight size={18} />
            </button>
            <a className="outline-button" href="/api/download/quality">
              Read the data quality report
            </a>
          </aside>
        </div>
      </div>
    </div>
  );
}
function ArrowDownIcon() {
  return <Download size={17} />;
}
function App() {
  const [boot, B] = useState<O>(),
    [country, C] = useState('India'),
    [data, D] = useState<O>(),
    [page, P] = useState('Overview'),
    [error, E] = useState(''),
    [startupError, setStartupError] = useState(''),
    [busy, L] = useState(false),
    [menu, M] = useState(false),
    [globePoints, G] = useState<GlobePoint[]>([]),
    [globeError, GE] = useState('');
  const init = () => {
    setStartupError('');
    return api('/bootstrap')
      .then(B)
      .catch((e) => setStartupError(e.message));
  };
  useEffect(() => {
    init();
    api('/atlas?model=gmm&month=2026-08')
      .then((d) =>
        G(
          d.items.map((r: O) => ({
            country: r.country,
            total_co2: r.total_co2,
          })),
        ),
      )
      .catch(() =>
        GE(
          'Globe data unavailable. Country datasets are still accessible below.',
        ),
      );
  }, []);
  useEffect(() => {
    let live = true;
    L(true);
    D(undefined);
    E('');
    api('/country?name=' + encodeURIComponent(country))
      .then((d) => live && D(d))
      .catch((e) => live && E(e.message))
      .finally(() => live && L(false));
    return () => {
      live = false;
    };
  }, [country]);
  const go = (p: string) => {
    P(p);
    M(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  if (!boot)
    return (
      <div className="startup">
        <span className="loading-mark" />
        <span className="wordmark-text">CARBONSCOPE</span>
        <p>{startupError || 'Bringing the evidence into view…'}</p>
        {startupError && <button onClick={init}>Try again</button>}
      </div>
    );
  const audit = boot.audit,
    research = boot.research,
    last = data?.history.at(-1),
    history = data?.history || [],
    home = page === 'Overview',
    explorer = [
      'Clean dataset',
      'Emission patterns',
      'Future forecast',
    ].includes(page);
  return (
    <div
      className={
        'app ' +
        (home
          ? 'is-home'
          : explorer
            ? 'is-workspace is-explorer'
            : 'is-workspace')
      }
    >
      <header className="site-header">
        <button
          className="wordmark"
          onClick={() => M(true)}
          aria-expanded={menu}
          aria-controls="feature-menu"
          aria-haspopup="dialog"
        >
          CARBONSCOPE
          <span className="caret">
            <ChevronDown size={17} />
          </span>
        </button>
        <div className="header-context">
          {!home && (
            <button className="home-link" onClick={() => go('Overview')}>
              <Home size={16} />
              <span>Home</span>
            </button>
          )}
          <span className="header-page">
            {home ? 'PATTERNS TO PREDICTION' : page}
          </span>
        </div>
        <div className="header-right">
          <span className="snapshot-status">
            <i />
            AUGUST 2026 SNAPSHOT
          </span>
          <label className="country-picker">
            <span className="sr-only">Country</span>
            <select
              aria-label="Country"
              value={country}
              onChange={(e) => C(e.target.value)}
            >
              {boot.countries.map((c: string) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
      </header>
      {menu && <FeatureMenu go={go} close={() => M(false)} />}
      <main>
        {home && (
          <section className="earth-hero" aria-labelledby="hero-title">
            <div className="hero-atmosphere" />
            <div className="hero-globe">
              <Suspense
                fallback={
                  <div className="globe-loading">Preparing the globe…</div>
                }
              >
                <Globe points={globePoints} country={country} onCountry={C} />
              </Suspense>
            </div>
            <div className="hero-copy">
              <div className="hero-kicker">
                <span />
                EXPLORER V2 · THE BIGGER PICTURE
              </div>
              <h1 id="hero-title">
                Every emission
                <br />
                has a pattern.
              </h1>
              <p className="hero-description">
                Understand country emissions.
                <br />
                Discover the patterns. Explore what comes next.
              </p>
              <div className="hero-actions">
                {Object.entries(featureDescriptions).map(([p, item], i) => (
                  <button
                    key={p}
                    className={
                      'hero-action ' + (i === 2 ? 'accent-action' : '')
                    }
                    onClick={() => go(p)}
                  >
                    <span>
                      <strong>{item.title}</strong>
                      <small>
                        {i === 0
                          ? 'Published estimates across 36 countries and six sectors.'
                          : i === 1
                            ? 'Clustering and latent dimensions, compared with evidence.'
                            : 'Monthly forecasts, tested against simple baselines.'}
                      </small>
                    </span>
                    <ArrowRight size={26} />
                  </button>
                ))}
              </div>
            </div>
            <div className="hero-bottom">
              <span>
                <i />
                COUNTRY-LEVEL EMISSIONS · AUG 2026
              </span>
              <span>
                Bar height: log-scaled monthly CO₂ · representative country
                locations
              </span>
              <a href="#study">Explore the study ↓</a>
            </div>
            {globeError && (
              <p className="globe-error" role="status">
                {globeError}
              </p>
            )}
          </section>
        )}
        <div className="content" id="study">
          {!home && !explorer && (
            <div className="page-heading">
              <div>
                <span className="eyebrow">THE CARBONSCOPE WORKSPACE</span>
                <h1>{page}</h1>
                <p>
                  {
                    (
                      {
                        'Clean dataset':
                          'The full picture starts with transparent data.',
                        'Emission patterns':
                          'Similar countries. Different profiles. Look closer.',
                        'Model comparison':
                          'Different approaches. One shared standard of evidence.',
                        'Future forecast':
                          'An informed look ahead, with uncertainty in view.',
                        'Presentation guide':
                          'The story, the science, and what to show.',
                      } as O
                    )[page]
                  }
                </p>
              </div>
              <a className="button secondary" href="/api/download/monthly">
                <Download size={16} />
                Clean dataset
              </a>
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {busy && !home && <p role="status">Loading {country}…</p>}
          {home && (
            <div className="section-intro">
              <div>
                <span className="eyebrow">FROM OBSERVATIONS TO INSIGHT</span>
                <h2>
                  The evidence behind
                  <br />
                  the bigger picture.
                </h2>
              </div>
              <p>
                A common dataset. Five core learning methods.
                <br />A transparent comparison of what they reveal.
              </p>
            </div>
          )}
          {home && (
            <>
              <div className="stats">
                <Stat
                  label="Countries in the study"
                  value={audit.countries}
                  note="One common cohort"
                />
                <Stat
                  label="Monthly observations"
                  value={fmt(audit.monthly_rows, 0)}
                  note="January 2019–August 2026"
                />
                <Stat
                  label="Reported sectors"
                  value="6"
                  note="Source estimates, summed monthly"
                />
                <Stat
                  label="Core learning methods"
                  value="5"
                  note="Clustering and latent dimensions"
                />
              </div>
              <div className="grid">
                <Card
                  title={`${country} · the emissions story`}
                  sub="Six-sector total · million tonnes CO₂ per month"
                >
                  <Trend
                    rows={history}
                    fields={[{ key: 'observed', name: 'Published emissions' }]}
                  />
                  <button
                    className="text-button"
                    onClick={() => go('Clean dataset')}
                  >
                    Explore the data <ArrowUpRight size={16} />
                  </button>
                </Card>
                <Card
                  title="Understand. Compare. Question."
                  sub="A research project built around the evidence"
                >
                  <div className="steps">
                    {[
                      [
                        '01',
                        'Prepare the data',
                        'Validate real daily records and aggregate complete months.',
                      ],
                      [
                        '02',
                        'Find the patterns',
                        'Compare clustering, PCA and Factor Analysis.',
                      ],
                      [
                        '03',
                        'Test the future',
                        'Evaluate forecasts against simple baselines.',
                      ],
                    ].map(([n, t, s]) => (
                      <div key={n}>
                        <span>{n}</span>
                        <div>
                          <h4>{t}</h4>
                          <p>{s}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="text-button"
                    onClick={() => go('Model comparison')}
                  >
                    See the comparison <ArrowUpRight size={16} />
                  </button>
                </Card>
              </div>
              {data && (
                <div className="insight">
                  <Activity size={21} />
                  <p>
                    <b>{country}, August 2026:</b> {fmt(last.observed)} Mt
                    across the six reported sectors. Largest contribution:{' '}
                    <b>
                      {
                        labels[
                          sectorKeys.reduce((a, b) =>
                            last[a] > last[b] ? a : b,
                          )
                        ]
                      }
                    </b>
                    .
                  </p>
                </div>
              )}
              <div className="geography-note">
                <Globe2 size={20} />
                <p>
                  The globe shows national six-sector totals at representative
                  country locations. It does not identify individual factories
                  or local pollution hotspots. Countries outside the study have
                  no emissions marker. Geography: Natural Earth via world-atlas.
                </p>
              </div>
            </>
          )}
          {page === 'Clean dataset' && (
            <CountryExplorer
              boot={boot}
              data={data}
              country={country}
              onCountry={C}
              details={
                <DatasetDetails
                  audit={audit}
                  country={country}
                  history={history}
                />
              }
            />
          )}
          {page === 'Emission patterns' && (
            <PatternsExplorer
              boot={boot}
              data={data}
              country={country}
              onCountry={C}
              details={(family, month, onFamily, onMonth) => (
                <Patterns
                  boot={boot}
                  country={country}
                  data={data}
                  family={family}
                  month={month}
                  onFamilyChange={onFamily}
                  onMonthChange={onMonth}
                />
              )}
            />
          )}
          {page === 'Model comparison' && (
            <Models research={research} data={data} />
          )}
          {page === 'Future forecast' && data && (
            <ForecastExplorer
              key={country}
              boot={boot}
              data={data}
              country={country}
              onCountry={C}
              details={(method, target, onMethod, onTarget) => (
                <Forecast
                  data={data}
                  country={country}
                  controlledMethod={method}
                  controlledTarget={target}
                  onMethodChange={onMethod}
                  onTargetChange={onTarget}
                />
              )}
            />
          )}
          {page === 'Presentation guide' && (
            <Guide audit={audit} research={research} />
          )}

          <footer>
            <button className="footer-brand" onClick={() => go('Overview')}>
              CARBONSCOPE
            </button>
            <span>
              Carbon Monitor · January 2019–August 2026
              <br />
              Published estimates. Exploratory research. · Explorer V2
            </span>
            <button className="text-button" onClick={() => M(true)}>
              Explore all features <ArrowUpRight size={16} />
            </button>
          </footer>
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
