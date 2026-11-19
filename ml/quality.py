"""Structural validation and non-destructive anomaly review for the included snapshot."""
import hashlib
import numpy as np
import pandas as pd

FEATURES=['power','industry','ground_transport','residential','domestic_aviation','international_aviation']
SECTORS=dict(zip(['Power','Industry','Ground Transport','Residential','Domestic Aviation','International Aviation'],FEATURES))

def validate_snapshot(root,audit):
    monthly_path=root/'data/clean_monthly.csv'
    if hashlib.sha256(monthly_path.read_bytes()).hexdigest()!=audit['clean_sha256']:
        raise ValueError('Monthly snapshot SHA-256 mismatch; review changed data before rebuilding.')
    daily_path=root/'data/clean_daily.csv'
    if audit.get('daily_sha256') and hashlib.sha256(daily_path.read_bytes()).hexdigest()!=audit['daily_sha256']:
        raise ValueError('Daily snapshot SHA-256 mismatch.')
    m=pd.read_csv(monthly_path);d=pd.read_csv(daily_path)
    if m.isna().any().any() or d.isna().any().any():raise ValueError('Missing snapshot values')
    if m.duplicated(['country','month']).any() or d.duplicated(['country','date','sector']).any():raise ValueError('Duplicate snapshot keys')
    if not np.isfinite(m[FEATURES+['total_co2']]).all().all() or not np.isfinite(d.co2_mt).all():raise ValueError('Nonfinite emissions')
    if (m[FEATURES+['total_co2']]<0).any().any() or (d.co2_mt<0).any():raise ValueError('Negative emissions')
    dates=pd.to_datetime(d.date,format='%Y-%m-%d',errors='raise')
    if set(d.sector)!=set(SECTORS):raise ValueError('Unexpected sectors')
    countries=set(m.country)
    if countries!=set(d.country) or countries.intersection({'WORLD','EU27','ROW'}):raise ValueError('Country cohort mismatch')
    expected=pd.date_range(audit['start_date'],audit['end_date'])
    counts=d.groupby(['country','sector']).date.nunique()
    if len(counts)!=len(countries)*6 or not counts.eq(len(expected)).all() or dates.min()!=expected[0] or dates.max()!=expected[-1]:raise ValueError('Incomplete daily panel')
    periods=pd.period_range(expected[0],expected[-1],freq='M').astype(str)
    if set(m.month)!=set(periods) or not m.groupby('country').month.nunique().eq(len(periods)).all():raise ValueError('Incomplete monthly panel')
    aggregate=d.assign(month=d.date.str[:7]).groupby(['country','month','sector']).co2_mt.sum().unstack().rename(columns=SECTORS)[FEATURES].sort_index()
    values=m.set_index(['country','month'])[FEATURES].sort_index()
    np.testing.assert_allclose(aggregate.to_numpy(),values.to_numpy(),atol=5e-8,rtol=1e-8)
    np.testing.assert_allclose(m[FEATURES].sum(axis=1),m.total_co2,atol=5e-8,rtol=1e-8)
    if len(m)!=audit['monthly_rows'] or len(d)!=audit['daily_rows'] or len(countries)!=audit['countries']:raise ValueError('Audit count mismatch')
    return m.sort_values(['country','month']).reset_index(drop=True),d

def quality_report(monthly):
    flags=[]
    for country,q in monthly.groupby('country'):
        q=q.sort_values('month').reset_index(drop=True)
        for feature in FEATURES:
            prior=q[feature].shift(12)
            # Review signal, not a rule for deleting real observations. A minimum
            # absolute movement avoids flagging enormous ratios around tiny zeros.
            mask=(prior>0)&(q[feature]>4*prior)&((q[feature]-prior)>=1)
            for i in q.index[mask]:
                flags.append({'country':country,'month':q.loc[i,'month'],'feature':feature,
                    'value_mt':float(q.loc[i,feature]),'previous_year_mt':float(prior.loc[i]),
                    'ratio':float(q.loc[i,feature]/prior.loc[i]),'status':'unresolved_source_review',
                    'reason':'Above 4x the same month one year earlier, with an increase of at least 1 Mt.'})
    return {'status':'review_required' if flags else 'no_rule_flags','rule':'Sector >4x year-earlier value AND increase >=1 Mt; flags are review signals, not proof of error.',
        'action':'Original values retained. Verify against original source, units and revisions before interpreting affected countries or publishing forecasts.',
        'countries_with_flags':sorted({r['country'] for r in flags}),'flags':flags,
        'limitations':'This rule does not detect every anomaly or validate source authenticity. Structural completeness is separate from scientific plausibility.'}
