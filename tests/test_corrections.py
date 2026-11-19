import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient
from threadpoolctl import threadpool_limits

from backend.app.main import app, state
from ml import build
from ml.quality import quality_report, validate_snapshot

ROOT=Path(__file__).resolve().parents[1]


def test_original_raw_cleaning_reproduces_both_csvs(monkeypatch,tmp_path):
    audit=json.loads((ROOT/'artifacts/audit.json').read_text())
    raw=ROOT/'datasets/raw/carbon_monitor.csv'
    assert hashlib.sha256(raw.read_bytes()).hexdigest()==audit['source_sha256']
    monkeypatch.setattr(build,'ROOT',tmp_path)
    build.clean(raw)
    for name in ['clean_daily.csv','clean_monthly.csv']:
        # Pandas uses the host newline for generated CSVs. Compare content after
        # newline normalization and keep the archived source-byte check above.
        generated = (tmp_path / 'data' / name).read_text(encoding='utf-8')
        bundled = (ROOT / 'data' / name).read_text(encoding='utf-8')
        assert generated == bundled


def test_snapshot_and_anomaly_flags_retain_source_values():
    s=state();d,_=validate_snapshot(ROOT,s['audit'])
    report=json.loads((ROOT/'artifacts/data_quality.json').read_text())
    assert quality_report(d)==report
    assert report['status']=='review_required'
    row=d[(d.country=='Sweden')&(d.month=='2026-08')].iloc[0]
    assert np.isclose(row.power,33.665488)
    assert any(r['country']=='Sweden' and r['month']=='2026-04' and r['feature']=='power' for r in report['flags'])
    c=TestClient(app)
    assert c.get('/api/country?name=Sweden').json()['data_warnings']
    assert c.get('/api/download/quality').json()==report


def test_gmm_forecast_regression_real_previously_explosive_windows():
    s=state()
    with threadpool_limits(limits=1):
        for country,origin,horizon in [('India',47,12),('India',71,12),('Sweden',79,10),('Sweden',91,5)]:
            frame=s['data'][s['data'].country.eq(country)].iloc[:origin+1]
            y=frame[build.FEATURES].to_numpy();months=pd.to_datetime(frame.month).dt.month.to_numpy()
            reps=build.representation(s['models'],y)
            pred=build.prediction(y,months,origin,horizon,'gmm',reps)
            assert np.isfinite(pred).all() and (pred>=0).all()
            # Detect the former orders-of-magnitude numerical blow-up; a
            # scientifically questionable extrapolation must instead be flagged.
            assert pred.sum()<10*y.sum(axis=1).max()
            if pred.sum()>3*y.sum(axis=1).max():
                assert build.forecast_warnings(pred,y)
            item=s['forecast']['countries'][country]
            if origin==91:expected=item['method_forecasts']['gmm'][horizon-1]['predicted']
            else:
                split='validation' if origin==47 else 'test'
                expected=next(r['predicted'] for r in item['evaluation']['gmm'][split]['rows'] if r['origin']==frame.iloc[-1].month and r['horizon']==horizon)
            assert np.isclose(pred.sum(),expected,rtol=1e-6,atol=1e-7)


def test_all_future_warnings_and_sector_control_are_present():
    s=state()
    assert 'sectors' in s['forecast']['methods']
    for country,item in s['forecast']['countries'].items():
        y=s['data'][s['data'].country.eq(country)][build.FEATURES].to_numpy()
        assert len(item['evaluation'])==8
        for method,rows in item['method_forecasts'].items():
            for row in rows:
                values=np.array([row['sectors'][f] for f in build.FEATURES])
                assert row['warnings']==build.forecast_warnings(values,y)
    exports=pd.read_csv(ROOT/'data/forecasts.csv',keep_default_na=False)
    assert {'source_review_required','extrapolation_review_required','review_notes'}.issubset(exports.columns)
    assert exports.query("country=='Sweden'").source_review_required.all()


def test_runtime_files_selected_by_docker_are_sufficient(tmp_path):
    # Exercise precisely the content selected by Docker COPY, without assuming
    # a daemon is available in the test environment.
    import shutil
    runtime_stage = (ROOT / 'Dockerfile').read_text().split('FROM python:', 1)[1]
    for line in runtime_stage.splitlines():
        if not line.startswith('COPY '):
            continue
        if line.startswith('COPY --from=frontend-build '):
            shutil.copytree(ROOT / 'frontend/dist', tmp_path / 'frontend/dist')
            continue
        _, source, destination = line.split()
        target = tmp_path / (source if destination == './' else destination)
        if (ROOT / source).is_dir():
            shutil.copytree(ROOT / source, target)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / source, target)
    code="""from fastapi.testclient import TestClient
from backend.app.main import app
c=TestClient(app)
for path in ['/','/api/v1/health','/api/bootstrap','/api/country?name=India','/api/download/raw','/api/download/daily','/api/download/guide','/api/download/quality']:
    r=c.get(path)
    assert r.status_code==200,(path,r.status_code)
"""
    result=subprocess.run([sys.executable,'-c',code],cwd=tmp_path,capture_output=True,text=True)
    assert result.returncode==0,result.stderr


def test_saved_report_matches_current_build_code():
    forecast=state()['forecast']
    assert hashlib.sha256((ROOT/'ml/build.py').read_bytes()).hexdigest()==forecast['code_sha256']
    assert 'inspected' in forecast['revision_note'].lower()
    assert 'not a newly untouched final test' in forecast['revision_note'].lower()


def test_current_downloads_frontend_assets_and_errors():
    import re
    c=TestClient(app)
    for kind in ['raw','monthly','daily','forecasts','quality','audit','research','guide']:
        assert c.get('/api/download/'+kind).status_code==200
    for path in re.findall(r'(?:src|href)="(/assets/[^\"]+)"',c.get('/').text):
        assert c.get(path).status_code==200
    assert c.get('/api/download/unknown').status_code==404
    assert c.get('/api/atlas?model=unknown').status_code==422
