# CarbonScope - short presentation notes

Open CARBONSCOPE at the top-left to access all project features. On the homepage, the globe rotates continuously; pause or drag it to inspect representative country markers. Marker heights show log-scaled August 2026 monthly six-sector totals, not individual facilities or local pollution hotspots.

## Opening (20 seconds)
Our project compares Unit 3 models on real country-level carbon emissions and tests whether learned patterns improve future monthly forecasts. We use Carbon Monitor estimates through August 2026, so the recent history includes actual published 2025 and 2026 records.

## 1. Overview
Show 36 countries, 3,312 monthly records and six sectors. Explain that historical source estimates and our future predictions are different. Select India or another country in the top-right selector.

## 2. Clean dataset
The original source file is bundled and its exact hash matches the recorded source. Daily/monthly exports reproduce from it. Explain that completeness does not prove physical plausibility. The quality report flags large year-on-year changes without modifying the source, including Sweden power. Affected-country warnings remain visible.

Click Clean monthly CSV. It is the exact complete modelling dataset-not the original raw file. We removed an empty column and aggregate regions, checked unique keys and complete months, and preserved real zeros. Missing values were not replaced with invented numbers.

## 3. Emission patterns
Select GMM, K-Means and hierarchy. Hover over countries. PCA projects six features into two dimensions; it is not a geographic map. Cluster IDs are arbitrary and do not correspond between methods. Hierarchy supports only 2019–2022 fitted rows.

K-Means: nearest-centre hard groups. Objective J = sum of squared distances from points to their assigned centres.
GMM: probability-weighted Gaussian mixture, p(x) = sum_k pi_k N(x|mu_k,Sigma_k).
EM: E-step estimates memberships; M-step updates parameters. It trains GMM and is not a separate competitor.
Ward: merge groups causing the smallest increase in within-group squared error.

Optional demo: open Try a measured profile and click Analyse profile. Explain that this predicts a group, not future emissions.

## 4. Model comparison
Silhouette: (b-a)/max(a,b), with a=within-group mean distance and b=nearest-other-group mean distance. Higher is better. Davies–Bouldin is lower-is-better; stability ARI measures agreement across country subsamples. These are not classification accuracy percentages.
Show K-Means elbow, GMM BIC curve, actual EM convergence, dendrogram and distance comparison. Different methods have different objectives; no universal winner is claimed.

PCA maximises retained variance: explained variance ratio = eigenvalue / sum of eigenvalues.
Factor Analysis: x = mu + Lambda z + epsilon; shared factors plus feature-specific noise.
Compare equal latent dimensions and held-out reconstruction error. PCA has an advantage for reconstruction by design; that does not disprove Factor Analysis.

## 5. Future forecast
Choose January 2027 and a country. The default is the validation-selected approach; change the approach to compare Ridge with Unit 3 features and simple baselines. Show the total, sector contributions and historical-error range.

Models use earlier emissions and known calendar seasonality. Ridge models are fitted separately for each horizon, so they do not require actual future emissions or use recursively invented observations. Future quantities are estimates, not guarantees.

For India, persistence won validation. Its flat forecast is intentional and honest. Do not describe it as a trained GMM forecast. Select Ridge + GMM to demonstrate the alternative, then show its corrected measured error comparison. Membership probabilities bypass regression variance scaling; near-zero country-specific scaling previously caused explosive forecasts. Sector-history Ridge is an additional information control. A baseline winning is a valid research result.

Explain MAE = mean(|actual-predicted|); RMSE = square root of mean squared error. Lower is better. sMAPE is an error percentage, not classification accuracy.

## 6. Usefulness and conclusion
The predicted sector mix helps identify sectors to monitor and compare expected changes. It does not establish causes or prescribe policy. Our contribution is the controlled comparison: whether unsupervised profiles or latent dimensions improve forecasting relative to history alone and simple baselines.

## Dates and splits
- Source coverage: 1 January 2019–31 August 2026.
- Unit 3 reference fitting: 2019–2022; development reporting: 2023; held-out reporting: 2024–August 2026.
- Forecast validation origins: Dec 2022, Mar/Jun/Sep 2023, each forecasting 1–12 months.
- Test origins: Sep/Dec 2024, Mar/Jun/Aug 2025, each forecasting 1–12 months, ending by August 2026.
- Reference transforms are fixed before the first forecast-validation origin. Each regression scaler fits its own training window. Selection uses validation only.
- Production forecasts: September 2026–August 2027; only months after the current calendar month are offered as future selections. Earlier unsupported months remain labelled estimates.

## If asked about missing September–November 2026
Our downloaded source ends in August 2026. We do not pretend later observed data exists. Those are estimated months, and January 2027 is five months beyond our last published source value.

## Corrections and honest limitations
This corrected release reuses previously inspected test periods. Call it a revised exploratory comparison, not a fresh sealed final test. Report actual saved scores; do not claim that learned representations consistently beat simple baselines. Four validation errors per horizon are not enough for calibrated intervals. Source anomalies and large extrapolation warnings must be explained, not hidden. A raw file hash establishes byte identity, not scientific correctness of every estimate.
