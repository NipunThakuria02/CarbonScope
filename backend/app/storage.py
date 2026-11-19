"""Load the immutable data snapshot once per application process."""
import hashlib
import json
from functools import lru_cache
from pathlib import Path

import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / 'frontend/dist'
ARTIFACTS = ROOT / 'artifacts'
DATA = ROOT / 'data'
EXPORTS = {
    'raw': ('datasets/raw/carbon_monitor.csv', 'CarbonMonitor_Original_Source.csv'),
    'monthly': ('data/clean_monthly.csv', 'CarbonScope_Clean_Monthly_2019_2026.csv'),
    'daily': ('data/clean_daily.csv', 'CarbonScope_Clean_Daily_2019_2026.csv'),
    'forecasts': ('data/forecasts.csv', 'CarbonScope_Forecasts.csv'),
    'quality': ('artifacts/data_quality.json', 'CarbonScope_Data_Quality.json'),
    'audit': ('artifacts/audit.json', 'CarbonScope_Data_Audit.json'),
    'research': ('artifacts/research.json', 'CarbonScope_Model_Comparison.json'),
    'guide': ('docs/presentation-guide.md', 'CarbonScope_Presentation_Guide.md'),
}


def read_report(filename):
    return json.loads((ARTIFACTS / filename).read_text(encoding='utf-8'))


@lru_cache(maxsize=1)
def state():
    data = pd.read_csv(DATA / 'clean_monthly.csv')
    hierarchy = pd.read_csv(DATA / 'hierarchical_assignments.csv')
    model_path = ARTIFACTS / 'models.joblib'
    # The fitted bundle is shipped with the application and is never user supplied.
    models = joblib.load(model_path)
    reference = data.loc[data.month.le('2022-12'), models['features']]
    return {
        'audit': read_report('audit.json'),
        'quality': read_report('data_quality.json'),
        'research': read_report('research.json'),
        'forecast': read_report('forecast.json'),
        'data': data,
        'points': pd.read_csv(DATA / 'model_assignments.csv'),
        'hier': hierarchy.merge(data, on=['country', 'month'], how='left'),
        'models': models,
        'model_sha256': hashlib.sha256(model_path.read_bytes()).hexdigest(),
        'reference_min': reference.min(),
        'reference_max': reference.max(),
    }


def check_exports():
    for relative, _ in EXPORTS.values():
        if not (ROOT / relative).is_file():
            raise RuntimeError(f'Missing deployment file: {relative}')
