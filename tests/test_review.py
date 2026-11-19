import io,json
from pathlib import Path
from datetime import datetime,timezone
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient
from backend.app.main import app,state
from ml.build import FEATURES,representation,prediction

ROOT=Path(__file__).resolve().parents[1]

def test_clean_exports_have_no_missing_duplicates_or_aggregate_regions():
    client=TestClient(app)
    for kind,keys in [('monthly',['country','month']),('daily',['country','date','sector'])]:
        r=client.get('/api/download/'+kind);assert r.status_code==200
        d=pd.read_csv(io.BytesIO(r.content));assert not d.isna().any().any();assert not d.duplicated(keys).any()
        assert not d.country.isin(['WORLD','EU27','ROW']).any()
    d=state()['data'];assert len(d)==3312;assert d.country.nunique()==36
    np.testing.assert_allclose(d[FEATURES].sum(axis=1),d.total_co2,atol=4e-9)

def test_monthly_aggregation_matches_daily_source_export():
    d=pd.read_csv(ROOT/'data/clean_daily.csv');d['month']=d.date.str[:7]
    pivot=d.groupby(['country','month','sector']).co2_mt.sum().unstack()
    from ml.build import SECTORS
    pivot=pivot.rename(columns=SECTORS)[FEATURES].sort_index()
    monthly=state()['data'].set_index(['country','month'])[FEATURES].sort_index()
    np.testing.assert_allclose(pivot.to_numpy(),monthly.to_numpy(),atol=5e-8,rtol=1e-8)

def test_future_months_and_routes():
    c=TestClient(app);b=c.get('/api/bootstrap');assert b.status_code==200
    assert b.json()['audit']['end_date']=='2026-08-31'
    for country in ['India','Brazil','United Kingdom']:
        r=c.get('/api/country',params={'name':country});assert r.status_code==200;d=r.json()
        assert all(m>datetime.now(timezone.utc).strftime('%Y-%m') for m in d['future_months'])
        assert d['future_months']==[r['month'] for r in d['forecasts'] if r['month']>datetime.now(timezone.utc).strftime('%Y-%m')];assert len(d['method_forecasts'])==len(d['methods'])
    assert c.get('/api/country?name=Unknown').status_code==404
    assert c.get('/api/atlas?model=hierarchical&month=2026-08').status_code==422
    assert c.get('/api/atlas?model=hierarchical&month=2022-12').status_code==200
    assert c.get('/api/download/guide').status_code==200
    assert c.get('/').status_code==200

def test_profile_inference_and_input_validation():
    c=TestClient(app);s=state();row=s['data'].query("country=='India'").iloc[-1];vals={k:float(row[k]) for k in FEATURES}
    g=c.post('/api/profile',json={'model':'gmm','values':vals});assert g.status_code==200
    assert np.isclose(sum(g.json()['probabilities']),1)
    assert c.post('/api/profile',json={'model':'hierarchical','values':vals}).status_code==422
    assert c.post('/api/profile',json={'model':'gmm','values':{'power':2}}).status_code==422
    vals['power']=-1;assert c.post('/api/profile',json={'model':'gmm','values':vals}).status_code==422

def test_selection_chronology_and_reported_errors():
    f=state()['forecast'];assert max(f['validation_origins'])=='2023-09';assert min(f['test_origins'])=='2024-09'
    for country,item in f['countries'].items():
        expected=min(item['evaluation'],key=lambda m:item['evaluation'][m]['validation']['metrics']['mae'])
        assert expected==item['selected']
        for method,e in item['evaluation'].items():
            assert max(r['month'] for r in e['validation']['rows'])<min(r['month'] for r in e['test']['rows'])
            for split in ['validation','test']:
                rows=e[split]['rows'];errors=np.array([r['actual']-r['predicted'] for r in rows])
                assert np.isclose(abs(errors).mean(),e[split]['metrics']['mae'])
                assert all(r['origin']<r['month'] for r in rows)
        for method,rows in item['method_forecasts'].items():
            for row in rows:
                assert 0<=row['lower']<=row['predicted']<=row['upper']
                assert np.isclose(sum(row['sectors'].values()),row['predicted'])
                assert all(np.isfinite(v) and v>=0 for v in row['sectors'].values())

def test_forecasts_reproduce_without_future_inputs():
    s=state();frame=s['data'].query("country=='India'");y=frame[FEATURES].to_numpy();months=pd.to_datetime(frame.month).dt.month.to_numpy();b=s['models']
    # Representations and regression predictions use no rows after each tested origin.
    from threadpoolctl import threadpool_limits
    with threadpool_limits(limits=1):
        for origin in [47,79,91]:
            cut=y[:origin+1];cutmonths=months[:origin+1];reps=representation(b,cut)
            for method in s['forecast']['methods']:
                for horizon in [1,6,12]:
                    value=prediction(cut,cutmonths,origin,horizon,method,reps).sum()
                    if origin==91:
                        expected=s['forecast']['countries']['India']['method_forecasts'][method][horizon-1]['predicted']
                    else:
                        split='validation' if origin==47 else 'test'
                        rows=s['forecast']['countries']['India']['evaluation'][method][split]['rows']
                        expected=next(r['predicted'] for r in rows if r['origin']==frame.iloc[origin].month and r['horizon']==horizon)
                    assert np.isclose(value,expected,rtol=1e-6,atol=1e-7)
