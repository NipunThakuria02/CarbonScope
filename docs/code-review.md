# Code review

## Findings addressed

| Finding | Change |
| --- | --- |
| The old container required a prebuilt website and copied local research tooling into the runtime. | The root Dockerfile builds the website from the npm lockfile. Its separate Python stage includes the API, site, required data, and notices. It runs as a non-root user, accepts a host-provided port, and checks the health endpoint. |
| The archive shipped a Windows virtual environment, an OS-specific startup flow, duplicate documentation, and stale validation output. | Removed those files from the new release. Kept the data preparation and modelling code, scientific artifacts, frontend source, and active regression tests. |
| The source control exclusions hid data and model files that the service needs. | Retained all runtime inputs in the release and removed the exclusions for required snapshot and model files. |
| The API loaded reports and models on first request, joined hierarchy data repeatedly, and reread the model to hash it on each profile request. | Separated application setup, routes, and snapshot loading. The process loads once on startup and prepares the join, model digest, and reference bounds for reuse. |
| Large API responses were sent uncompressed, and the API accepted malformed month numbers. | Added gzip for eligible responses and calendar-month validation. Kept HTML and API responses fresh and enabled long-lived caching for fingerprinted static assets. |
| The launch instructions and Vite settings assumed a local demo setup. The npm audit flagged the pinned Vite version. | Replaced the launch scripts with standard commands, used Vite's local development default, and updated Vite within major version 7. |
| The app could hide bootstrap failures behind country request status, and duplicate fetch helpers handled errors differently. | Separated startup and country errors and shared the API request helper. Separated the main interface, study detail views, and shared chart and display components. |
| CSV reproduction tests failed on Windows due to platform-specific line endings. | Compare regenerated CSV text with newline normalization. Keep the original snapshot and its byte-level hash checks, and prevent Git from changing snapshot and research source bytes. |

## Remaining limits

- The snapshot ends in August 2026. Forecast values cover a fixed window ending in August 2027. The app uses the server's UTC month to decide which forecast entries are still in the future.
- Several source estimates remain flagged for scientific review. Historic forecasts use a revised source snapshot and previously inspected evaluation windows. The included tests cover data consistency and calculation reproducibility.
- Each server process keeps the snapshot and models in memory. The default container starts one worker. Downloads include the full raw and daily snapshots, so traffic affects hosting bandwidth.
- The production build reports two JavaScript chunks above Vite's size warning threshold. The globe loads in a separate chunk and the service compresses eligible responses.
