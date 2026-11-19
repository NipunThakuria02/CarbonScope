"""Read-only snapshot views, exports and fitted-model inference."""
import re
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, FiniteFloat

from .storage import EXPORTS, ROOT, state

router = APIRouter(prefix='/api')
MONTH = re.compile(r'[0-9]{4}-(?:0[1-9]|1[0-2])')
YEAR = re.compile(r'[0-9]{4}')


def current_month():
    return datetime.now(timezone.utc).strftime('%Y-%m')


def records(frame):
    return frame.to_dict(orient='records')


@router.get('/v1/health')
def health():
    return {'status': 'ready', 'data_end': state()['audit']['end_date'],
            'ui_release': 'explorer-motion-v2'}


@router.get('/bootstrap')
def bootstrap():
    snapshot = state()
    forecast = snapshot['forecast']
    return {
        'audit': snapshot['audit'], 'quality': snapshot['quality'],
        'research': snapshot['research'], 'countries': sorted(forecast['countries']),
        'methods': forecast['methods'], 'months': sorted(snapshot['data'].month.unique()),
        'current_month': current_month(),
    }


@router.get('/country')
def country(name: str = 'India'):
    snapshot = state()
    forecast = snapshot['forecast']
    item = forecast['countries'].get(name)
    if item is None:
        raise HTTPException(404, 'Unknown country')
    current = current_month()
    metadata = ('methods', 'interval_note', 'protocol', 'validation_origins',
                'test_origins', 'data_end', 'revision_note')
    points = snapshot['points']
    return {
        **item, **{key: forecast[key] for key in metadata},
        'country': name, 'current_month': current,
        'future_months': [row['month'] for row in item['forecasts'] if row['month'] > current],
        'assignments': records(points[points.country.eq(name)]),
    }


@router.get('/atlas')
def atlas(month: str = '2026-08', model: str = 'gmm'):
    if model not in ('kmeans', 'gmm', 'hierarchical'):
        raise HTTPException(422, 'Choose K-Means, GMM or hierarchical')
    if not MONTH.fullmatch(month):
        raise HTTPException(422, 'Use YYYY-MM')
    if model == 'hierarchical' and month > '2022-12':
        raise HTTPException(422, 'Hierarchy is fitted only on 2019 to 2022 reference observations')
    snapshot = state()
    frame = snapshot['hier'] if model == 'hierarchical' else snapshot['points']
    selected = frame[frame.month.eq(month)]
    if selected.empty:
        raise HTTPException(404, 'No records for this month')
    return {'items': records(selected), 'model': model, 'month': month}


def forecast_map(forecast, period, sector, method):
    if method not in ('recommended', *forecast['methods']):
        raise HTTPException(422, 'Unknown forecast approach')
    items = []
    for country_name, item in forecast['countries'].items():
        chosen = item['selected'] if method == 'recommended' else method
        row = next((row for row in item['method_forecasts'][chosen] if row['month'] == period), None)
        if row is None:
            raise HTTPException(404, 'No saved forecast for this month')
        values = row['sectors']
        items.append({
            'country': country_name,
            'total_co2': row['predicted'] if sector == 'all' else values[sector],
            **values, 'method': chosen, 'kind': 'forecast',
        })
    return items


@router.get('/explorer')
def explorer(mode: str = 'observed', period: str = '2026-08',
             aggregation: str = 'monthly', sector: str = 'all',
             method: str = 'recommended'):
    """Project snapshot observations or saved forecasts onto the globe."""
    snapshot = state()
    features = snapshot['models']['features']
    if mode not in ('observed', 'forecast'):
        raise HTTPException(422, 'Unknown explorer mode')
    if sector not in ('all', *features):
        raise HTTPException(422, 'Unknown sector')
    if aggregation not in ('monthly', 'annual'):
        raise HTTPException(422, 'Unknown aggregation')
    if mode == 'forecast' and aggregation != 'monthly':
        raise HTTPException(422, 'Forecasts are monthly')
    monthly = aggregation == 'monthly'
    if not (MONTH if monthly else YEAR).fullmatch(period):
        raise HTTPException(422, 'Use YYYY-MM' if monthly else 'Use YYYY')

    context = {'mode': mode, 'period': period, 'sector': sector, 'aggregation': aggregation}
    if mode == 'forecast':
        items = forecast_map(snapshot['forecast'], period, sector, method)
        return {**context, 'items': items, 'months_in_period': 1, 'kind': 'saved_forecast'}
    if method != 'recommended':
        raise HTTPException(422, 'Forecast methods do not apply to source observations')

    data = snapshot['data']
    if monthly:
        selected = data[data.month.eq(period)]
        months = 1
    else:
        selected = data[data.month.str.startswith(period + '-')]
        months = int(selected.month.nunique())
        selected = selected.groupby('country', as_index=False)[features + ['total_co2']].sum()
    if selected.empty:
        raise HTTPException(404, 'No source records for this period')
    if sector != 'all':
        selected = selected.assign(total_co2=selected[sector])
    return {
        **context, 'items': records(selected), 'months_in_period': months,
        'partial_year': not monthly and months < 12, 'kind': 'published_estimate',
    }


class Profile(BaseModel):
    model_config = ConfigDict(extra='forbid')
    model: str = 'gmm'
    values: dict[str, FiniteFloat]


@router.post('/profile')
def profile(request: Profile):
    if request.model not in ('kmeans', 'gmm'):
        raise HTTPException(422, 'Only K-Means and GMM support new profile inference')
    snapshot = state()
    bundle = snapshot['models']
    features = bundle['features']
    if set(request.values) != set(features) or any(value < 0 for value in request.values.values()):
        raise HTTPException(422, 'Enter all six non-negative sector values in Mt per month')

    values = pd.DataFrame([request.values], columns=features)
    transformed = bundle['transform'].transform(np.log1p(values))
    model = bundle['models'][request.model]
    outside_reference = (
        (values.iloc[0] < snapshot['reference_min']) |
        (values.iloc[0] > snapshot['reference_max'])
    ).any()
    return {
        'cluster': int(model.predict(transformed)[0]),
        'probabilities': model.predict_proba(transformed)[0].tolist() if request.model == 'gmm' else [],
        'outside_reference': bool(outside_reference), 'model': request.model,
        'source_sha256': snapshot['audit']['source_sha256'],
        'model_sha256': snapshot['model_sha256'],
    }


@router.get('/download/{kind}')
def download(kind: str):
    if kind not in EXPORTS:
        raise HTTPException(404, 'Unknown export')
    path, name = EXPORTS[kind]
    return FileResponse(ROOT / path, filename=name)
