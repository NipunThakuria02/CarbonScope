import numpy as np
from fastapi.testclient import TestClient
from backend.app.main import app,state

client=TestClient(app)

def test_historical_explorer_filters_and_partial_year_are_true_source_sums():
    s=state();features=s['models']['features']
    for sector in ['all','power','industry']:
        result=client.get('/api/explorer',params={'period':'2026-08','sector':sector}).json()
        assert len(result['items'])==36
        row=next(r for r in result['items'] if r['country']=='India')
        observed=s['data'].query("country=='India' and month=='2026-08'").iloc[0]
        assert np.isclose(row['total_co2'],observed.total_co2 if sector=='all' else observed[sector])
    result=client.get('/api/explorer?period=2026&aggregation=annual').json()
    assert result['months_in_period']==8 and result['partial_year'] is True
    row=next(r for r in result['items'] if r['country']=='India')
    observed=s['data'][s['data'].country.eq('India') & s['data'].month.str.startswith('2026-')]
    assert np.isclose(row['total_co2'],observed.total_co2.sum())
    assert np.isclose(sum(row[f] for f in features),row['total_co2'])
    result=client.get('/api/explorer?period=2025&aggregation=annual').json()
    assert result['months_in_period']==12 and not result['partial_year']


def test_forecast_globe_matches_saved_methods_without_retraining():
    s=state()
    for method in ['recommended','gmm','seasonal','persistence']:
        result=client.get('/api/explorer',params={'mode':'forecast','period':'2027-01','method':method})
        assert result.status_code==200
        body=result.json();assert len(body['items'])==36
        for row in body['items']:
            source=s['forecast']['countries'][row['country']]
            selected=source['selected'] if method=='recommended' else method
            expected=next(r for r in source['method_forecasts'][selected] if r['month']=='2027-01')
            assert np.isclose(row['total_co2'],expected['predicted'])
            assert row['method']==selected
            assert np.isclose(sum(row[f] for f in s['models']['features']),row['total_co2'])
    response=client.get('/api/explorer?mode=forecast&period=2027-01&method=gmm&sector=power').json()
    assert all(np.isclose(row['total_co2'],row['power']) for row in response['items'])


def test_hierarchy_map_uses_each_countrys_actual_emissions_and_bad_filters_fail():
    s=state();body=client.get('/api/atlas?model=hierarchical&month=2022-12').json()
    assert len(body['items'])==36
    for row in body['items']:
        expected=s['data'][(s['data'].country==row['country'])&(s['data'].month=='2022-12')].iloc[0]
        assert np.isclose(row['total_co2'],expected.total_co2)
    for query in ['mode=unknown','sector=unknown','aggregation=unknown','period=2026','period=2026-13','mode=forecast&aggregation=annual&period=2027','mode=forecast&method=unknown&period=2027-01']:
        assert client.get('/api/explorer?'+query).status_code==422
    for query in ['period=2030-01','mode=forecast&period=2030-01']:
        assert client.get('/api/explorer?'+query).status_code==404
