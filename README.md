# CarbonScope Explorer

CarbonScope Explorer is an interactive research site for exploring monthly CO₂ emissions across 36 countries and six sectors. It combines Carbon Monitor's published estimates with emissions pattern analysis, comparisons of forecasting methods, and saved monthly forecasts.

## Site features

- **Country emissions.** Explore monthly and yearly totals on an interactive globe. Filter by sector, play the timeline, or inspect country-level trends and tables. The site identifies partial years.
- **Emission patterns.** Compare K-Means, Gaussian mixtures, and Ward hierarchical clustering. Inspect PCA and factor analysis, or enter a six-sector profile to see how the fitted K-Means and Gaussian mixture models classify it.
- **Future estimates.** Compare eight approaches, including seasonal and persistence baselines and Ridge regression variants. View estimates by country and sector, alongside historical errors and review flags.
- **Downloads.** Export the original source, cleaned daily and monthly data, selected forecasts, and data-quality and model reports.

## Selected results

The snapshot contains **604,800 daily country-sector records** and **3,312 country-month records** for January 2019 through August 2026. No observations were imputed. The quality review flagged 19 sector-month estimates across seven countries and retained the source values.

On the later evaluation windows, the same-month-last-year baseline had the lowest mean absolute error in **29 of 36 countries**. The validation-selected approach strictly beat that baseline in two countries. These are exploratory results from a revised analysis whose test windows had already been inspected. The saved forecast covers September 2026 through August 2027. Its displayed ranges summarize historical validation errors and have no calibrated coverage level.

## Datasets

- **Carbon Monitor global daily CO₂ estimates.** The bundled source snapshot is credited to Carbon Monitor and Liu et al. (2020). Download the original snapshot and the project's derived CSVs in the site. The project reports million tonnes of CO₂. Its six-sector total covers the reported sectors, including international aviation. Carbon Monitor publishes activity-based estimates that may be revised. [Carbon Monitor](https://carbonmonitor.org/) · [Source download](https://datas.carbonmonitor.org/API/downloadFullDataset.php?source=carbon_global) · [Research paper](https://doi.org/10.1038/s41597-020-00708-7)
- **Natural Earth country boundaries.** The globe uses the 1:110m boundaries bundled in World Atlas. The geography provides map context. The country markers represent national totals and use approximate display locations. [Natural Earth](https://www.naturalearthdata.com/) · [World Atlas](https://github.com/topojson/world-atlas)

Carbon Monitor publishes its data under a fair-use open data policy. Keep the source credit with public copies and check the policy before redistributing the snapshot. [Carbon Monitor data policy](https://carbonmonitor.org/)

## Tech stack

React, TypeScript, and Vite power the frontend. Three.js renders the globe with a Canvas fallback, and Recharts renders the charts. Python 3.12, FastAPI, and Uvicorn serve the website and API. Pandas, NumPy, SciPy, and scikit-learn support the data preparation and modelling.

## Run locally

The release ZIP includes a built frontend. With Python 3.12, run these commands from the extracted project directory, preferably in a virtual environment.

```sh
python -m pip install -r requirements.txt
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Open [CarbonScope locally](http://127.0.0.1:8000/) or the [API documentation](http://127.0.0.1:8000/docs). In a source checkout, or after frontend edits, build the site with `npm ci` and `npm run build` inside `frontend` using Node.js 24, then restart Uvicorn.

## Deploy

Build and run the container from the project directory.

```sh
docker build -t carbonscope .
docker run --rm -p 8000:8000 carbonscope
```

On a Docker-capable web hosting service, use the root Dockerfile, route traffic to the configured `PORT` (default `8000`), and set the health check path to `/api/v1/health`. The container builds the frontend and serves it on the same origin as the API. It uses the bundled snapshot and models and needs no database or API keys. Use the host's HTTPS endpoint for public access. Static-only hosting cannot serve the API.

## Reproduce and verify

Install the test dependencies with `python -m pip install -r requirements-dev.txt` and run `python -m pytest -q` from the project directory with a frontend build in place. To reproduce the research outputs in your working copy, run `python -m ml.build --source datasets/raw/carbon_monitor.csv`. Rebuilding overwrites derived files. The evaluation windows are fixed to this snapshot.
