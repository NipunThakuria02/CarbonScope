"""Reproducible CarbonScope review pipeline: real-source cleaning, Unit 3, future forecasting."""
import os
os.environ.setdefault('OMP_NUM_THREADS','1')
os.environ.setdefault('OPENBLAS_NUM_THREADS','1')
from pathlib import Path
import json, hashlib, time, warnings, argparse
from datetime import datetime, timezone
import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.feature_selection import VarianceThreshold
from sklearn.cluster import KMeans, AgglomerativeClustering
from sklearn.mixture import GaussianMixture
from sklearn.decomposition import PCA, FactorAnalysis
from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score, adjusted_rand_score
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from scipy.cluster.hierarchy import linkage, dendrogram
from threadpoolctl import threadpool_limits

ROOT=Path(__file__).resolve().parents[1]
SECTORS={'Power':'power','Industry':'industry','Ground Transport':'ground_transport','Residential':'residential','Domestic Aviation':'domestic_aviation','International Aviation':'international_aviation'}
FEATURES=list(SECTORS.values())
LABELS=dict(zip(FEATURES,SECTORS.keys()))
METHODS={'seasonal':'Same month last year','persistence':'Last observed month','history':'Ridge · total history','sectors':'Ridge + sector history','kmeans':'Ridge + K-Means','gmm':'Ridge + GMM','pca':'Ridge + PCA','factor':'Ridge + Factor Analysis'}
SOURCE='https://datas.carbonmonitor.org/API/downloadFullDataset.php?source=carbon_global'

def write(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(obj,indent=2,allow_nan=False))
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def metrics(z,l):
    return {'silhouette':float(silhouette_score(z,l,sample_size=min(1000,len(z)),random_state=42)), 'davies_bouldin':float(davies_bouldin_score(z,l)), 'calinski_harabasz':float(calinski_harabasz_score(z,l))}
def clean(source):
    (ROOT/'data').mkdir(parents=True,exist_ok=True);(ROOT/'artifacts').mkdir(parents=True,exist_ok=True)
    raw=pd.read_csv(source);required=['country','date','sector','value']
    if not set(required).issubset(raw):raise ValueError('Missing source columns')
    df=raw[required].copy();df['date']=pd.to_datetime(df.date,format='%d/%m/%Y',errors='coerce');df['value']=pd.to_numeric(df.value,errors='coerce')
    invalid=df[required].isna().any(axis=1)|~np.isfinite(df.value)|(df.value<0)
    rejected=int(invalid.sum())
    if rejected:raise ValueError(f'{rejected} invalid source records require review; no silent removal')
    df=df[~invalid]
    duplicated=df.duplicated(['country','date','sector'],keep=False)
    if duplicated.any():raise ValueError('Duplicate country/date/sector requires review; not silently summed')
    aggregate=df.country.isin(['WORLD','EU27','ROW']);aggregate_count=int(aggregate.sum());df=df[~aggregate]
    if set(df.sector)!=set(SECTORS):raise ValueError('Sector schema changed')
    df['month']=df.date.dt.to_period('M').astype(str)
    stats=df.groupby(['country','month','sector']).agg(value=('value','sum'),days=('date','nunique')).reset_index()
    stats['expected_days']=pd.to_datetime(stats.month).dt.days_in_month
    incomplete=stats.days.ne(stats.expected_days);incomplete_count=int(incomplete.sum());stats.loc[incomplete,'value']=np.nan
    wide=stats.pivot(index=['country','month'],columns='sector',values='value').rename(columns=SECTORS)[FEATURES]
    incomplete_months=int(wide.isna().any(axis=1).sum());wide=wide.dropna().reset_index()
    # A common uninterrupted panel makes all methods comparable; exclude rather than invent gaps.
    month_index=pd.period_range(wide.month.min(),wide.month.max(),freq='M').astype(str).tolist()
    counts=wide.groupby('country').month.nunique();eligible=counts[counts.eq(len(month_index))].index
    excluded=sorted(set(wide.country)-set(eligible));wide=wide[wide.country.isin(eligible)].sort_values(['country','month'])
    wide['total_co2']=wide[FEATURES].sum(axis=1)
    if wide.empty or wide.isna().any().any() or not np.isfinite(wide[FEATURES+['total_co2']]).all().all():raise ValueError('Clean panel validation failed')
    wide.to_csv(ROOT/'data/clean_monthly.csv',index=False,float_format='%.9f')
    # The daily export is also complete and contains no source's empty trailing column.
    daily=df[df.country.isin(eligible)].sort_values(['country','date','sector'])[required].copy();daily['date']=daily.date.dt.strftime('%Y-%m-%d');daily=daily.rename(columns={'value':'co2_mt'});daily.to_csv(ROOT/'data/clean_daily.csv',index=False,float_format='%.10f')
    audit={'source_name':'Carbon Monitor','source_url':SOURCE,'website':'https://carbonmonitor.org','citation':'Liu et al. (2020), Carbon Monitor, Scientific Data, doi:10.1038/s41597-020-00708-7','downloaded_at':datetime.now(timezone.utc).isoformat(),'source_sha256':sha(source),'clean_sha256':sha(ROOT/'data/clean_monthly.csv'),'raw_rows':len(raw),'empty_columns_removed':[c for c in raw if raw[c].isna().all()],'invalid_rows_removed':rejected,'aggregate_rows_removed':aggregate_count,'duplicates':0,'incomplete_sector_months_removed':incomplete_count,'incomplete_country_months_removed':incomplete_months,'excluded_countries':excluded,'countries':len(eligible),'monthly_rows':len(wide),'daily_rows':len(daily),'months':len(month_index),'start_date':df.date.min().strftime('%Y-%m-%d'),'end_date':df.date.max().strftime('%Y-%m-%d'),'missing_cells':int(wide.isna().sum().sum()),'imputed_cells':0,'unit':'million tonnes CO₂ (Mt)','target':'Sum of the six reported sectors, including allocated international aviation; not a complete national GHG inventory.','source_kind':'Published activity-based emissions estimates, not direct sensor measurements.','cleaning':['Remove entirely empty columns and aggregate regions.','Validate dates, finite non-negative emissions and unique keys.','Sum daily emissions only for complete calendar months.','Keep countries with all six sectors and a continuous monthly history.','Preserve genuine zeros; no interpolation, zero-filling or synthetic observations.']}
    write(ROOT/'artifacts/audit.json',audit);return wide,audit

def cluster_research(d):
    train=d.month.le('2022-12');dev=d.month.between('2023-01','2023-12');test=d.month.ge('2024-01')
    transform=StandardScaler().fit(np.log1p(d.loc[train,FEATURES]));allz=transform.transform(np.log1p(d[FEATURES]));z=allz[train];runs=[];fitted={};started=time.time()
    for family in ['kmeans','gmm','hierarchical']:
        for k in range(2,7):
            for cov in (['diag','full'] if family=='gmm' else [None]):
                t=time.time()
                model=KMeans(n_clusters=k,n_init=20,random_state=42) if family=='kmeans' else GaussianMixture(n_components=k,covariance_type=cov,n_init=5,max_iter=300,reg_covar=1e-6,random_state=42) if family=='gmm' else AgglomerativeClustering(n_clusters=k,linkage='ward')
                with warnings.catch_warnings(record=True) as ws:
                    labels=model.fit_predict(z)
                key=f'{family}-{k}'+('-'+cov if cov else '')
                row={'id':key,'family':family,'k':k,'covariance':cov or 'not applicable','seconds':time.time()-t,**metrics(z,labels),'warnings':[str(w.message) for w in ws]}
                if family=='kmeans':row['inertia']=float(model.inertia_)
                if family=='gmm':row.update(bic=float(model.bic(z)),aic=float(model.aic(z)),converged=bool(model.converged_),iterations=int(model.n_iter_))
                runs.append(row);fitted[key]=model
    selected={};models={}
    for family in ['kmeans','gmm','hierarchical']:
        choices=[r for r in runs if r['family']==family and (family!='gmm' or r['converged'])]
        best=min(choices,key=lambda r:r['bic']) if family=='gmm' else max(choices,key=lambda r:r['silhouette'])
        best['selected']=True;model=fitted[best['id']];models[family]=model
        if family!='hierarchical':
            best['development']=metrics(allz[dev],model.predict(allz[dev]));best['test']=metrics(allz[test],model.predict(allz[test]))
        else:best['development']=None;best['test']=None
        stability=[];traincountries=d.loc[train,'country'].to_numpy();unique=np.unique(traincountries)
        for seed in [7,21,42]:
            rng=np.random.default_rng(seed);keep=np.isin(traincountries,rng.choice(unique,int(.8*len(unique)),replace=False));subraw=np.log1p(d.loc[train,FEATURES].to_numpy()[keep]);sc=StandardScaler().fit(subraw);subz=sc.transform(subraw)
            if family=='kmeans':m=KMeans(n_clusters=best['k'],n_init=20,random_state=seed);base=model.predict(z[keep])
            elif family=='gmm':m=GaussianMixture(n_components=best['k'],covariance_type=best['covariance'],n_init=5,reg_covar=1e-6,random_state=seed,max_iter=300);base=model.predict(z[keep])
            else:m=AgglomerativeClustering(n_clusters=best['k'],linkage='ward');base=model.labels_[keep]
            stability.append(float(adjusted_rand_score(base,m.fit_predict(subz))))
        best['stability_ari']=float(np.mean(stability));selected[family]=best
    pca=PCA(n_components=6).fit(z);pca2=PCA(n_components=2).fit(z);fa=FactorAnalysis(n_components=2,random_state=42,max_iter=1000).fit(z)
    pcas=pca.transform(allz);factor=fa.transform(allz)
    reductions=[]
    for dim in range(1,7):
        pc=PCA(n_components=dim).fit(z);fm=FactorAnalysis(n_components=dim,random_state=42,max_iter=1000).fit(z)
        evalz=allz[test]
        reductions.append({'dimensions':dim,'pca_variance':float(pc.explained_variance_ratio_.sum()),'pca_test_mse':float(np.mean((evalz-pc.inverse_transform(pc.transform(evalz)))**2)),'factor_test_mse':float(np.mean((evalz-(fm.transform(evalz)@fm.components_+fm.mean_))**2)),'factor_test_log_likelihood':float(fm.score(evalz))})
    distance=[]
    for name,metric,link in [('Ward · Euclidean','euclidean','ward'),('Average · Euclidean','euclidean','average'),('Average · Manhattan','manhattan','average')]:
        m=AgglomerativeClustering(n_clusters=selected['hierarchical']['k'],metric=metric,linkage=link).fit(z);distance.append({'name':name,**metrics(z,m.labels_)})
    points=d[['country','month','total_co2']+FEATURES].copy();points['pc1']=pcas[:,0];points['pc2']=pcas[:,1]
    for family in ['kmeans','gmm']:points[family]=models[family].predict(allz)
    points['gmm_probability']=models['gmm'].predict_proba(allz).max(axis=1)
    # Hierarchy is explicitly available on fitted reference rows only.
    hier_points=points.loc[train,['country','month','pc1','pc2']].copy();hier_points['hierarchical']=models['hierarchical'].labels_
    profiles={}
    for family in ['kmeans','gmm','hierarchical']:
        labs=models[family].labels_ if family=='hierarchical' else models[family].predict(z)
        tmp=d.loc[train,FEATURES].copy();tmp['cluster']=labs
        profiles[family]=[{'cluster':int(k),'count':int((labs==k).sum()),'means':{f:float(v) for f,v in row.items()},'dominant_sector':max(row.to_dict(),key=row.to_dict().get)} for k,row in tmp.groupby('cluster')[FEATURES].mean().iterrows()]
    idx=np.linspace(0,len(z)-1,60,dtype=int);dg=dendrogram(linkage(z[idx],method='ward'),no_plot=True)
    report={'selected':selected,'runs':runs,'features':FEATURES,'labels':LABELS,'reference':'2019–2022','development':'2023','test':'2024–August 2026','counts':{'train':int(train.sum()),'development':int(dev.sum()),'test':int(test.sum())},'pca':{'variance':pca.explained_variance_ratio_.tolist(),'loadings':pca.components_.tolist(),'dimensions_90':int(np.searchsorted(np.cumsum(pca.explained_variance_ratio_),.90)+1)},'factor':{'loadings':fa.components_.tolist(),'noise_variance':fa.noise_variance_.tolist(),'log_likelihood':list(map(float,fa.loglike_))},'reduction_comparison':reductions,'distance_comparison':distance,'em':list(map(float,models['gmm'].lower_bounds_)),'dendrogram':{'icoord':dg['icoord'],'dcoord':dg['dcoord']},'profiles':profiles,'seconds':time.time()-started,'selection':'K-Means and Ward: highest reference silhouette. GMM: lowest reference BIC among converged fits. No future observations used in selection. PCA and Factor Analysis use two components for matched comparison.'}
    bundle={'transform':transform,'models':models,'pca':pca2,'factor':fa,'features':FEATURES}
    joblib.dump(bundle,ROOT/'artifacts/models.joblib')
    write(ROOT/'artifacts/research.json',report);points.to_csv(ROOT/'data/model_assignments.csv',index=False);hier_points.to_csv(ROOT/'data/hierarchical_assignments.csv',index=False)
    print('Unit 3 ready', {k:v['k'] for k,v in selected.items()},flush=True);return bundle,report

def error_metrics(rows):
    e=np.array([r['predicted']-r['actual'] for r in rows]);a=np.array([r['actual'] for r in rows]);p=np.array([r['predicted'] for r in rows]);return {'mae':float(np.mean(abs(e))),'rmse':float(np.sqrt(np.mean(e**2))),'smape':float(np.mean(2*abs(e)/np.maximum(abs(a)+abs(p),1e-12))*100),'n':len(rows)}

def representation(bundle,values):
    z=bundle['transform'].transform(np.log1p(pd.DataFrame(values,columns=FEATURES)))
    return {'history':np.empty((len(z),0)), 'sectors':np.log1p(values), 'kmeans':bundle['models']['kmeans'].transform(z),'gmm':bundle['models']['gmm'].predict_proba(z),'pca':bundle['pca'].transform(z),'factor':bundle['factor'].transform(z)}

def feature_row(y,month_numbers,o,h,rep):
    totals=y.sum(axis=1);targetmonth=(month_numbers[o]-1+h)%12+1
    return np.r_[totals[o],totals[o-1],totals[o-2],totals[o-11],np.sin(2*np.pi*targetmonth/12),np.cos(2*np.pi*targetmonth/12),rep[o]]

def prediction(y,months,origin,h,method,reps):
    if method=='seasonal':return y[origin+h-12].copy()
    if method=='persistence':return y[origin].copy()
    indexes=range(11,origin-h+1)
    x=np.array([feature_row(y,months,o,h,reps[method]) for o in indexes]);target=np.array([y[o+h] for o in indexes])
    if len(x)<12:raise ValueError('Insufficient training samples')
    # Memberships are bounded probabilities. Never divide tiny country-specific
    # membership variances into future memberships: this caused explosive forecasts.
    if method=='gmm':
        preprocessing=ColumnTransformer([
            ('history',make_pipeline(VarianceThreshold(threshold=1e-12),StandardScaler()),slice(0,6)),
            ('memberships','passthrough',slice(6,None))])
        model=make_pipeline(preprocessing,Ridge(alpha=10.)).fit(x,target)
    else:
        model=make_pipeline(VarianceThreshold(threshold=1e-12),StandardScaler(),Ridge(alpha=10.)).fit(x,target)
    return np.maximum(0,model.predict(feature_row(y,months,origin,h,reps[method]).reshape(1,-1))[0])

def forecasting(d,bundle,audit):
    result={};monthly=d.month.unique();monthly=sorted(monthly)
    quality=json.loads((ROOT/'artifacts/data_quality.json').read_text())
    # Fixed chronological protocol. Final-test targets all follow last validation target.
    validation_origins=[47,50,53,56];test_origins=[68,71,74,77,79]
    if len(monthly)!=92 or monthly[0]!='2019-01' or monthly[-1]!='2026-08':raise ValueError('Review split protocol before using another data coverage')
    for country,frame in d.groupby('country',sort=True):
        y=frame[FEATURES].to_numpy();months=pd.to_datetime(frame.month).dt.month.to_numpy();reps=representation(bundle,y)
        evaluation={}
        for method in METHODS:
            evaluation[method]={}
            for split,origins in [('validation',validation_origins),('test',test_origins)]:
                rows=[]
                for o in origins:
                    for h in range(1,13):
                        pred=prediction(y,months,o,h,method,reps)
                        rows.append({'origin':monthly[o],'month':monthly[o+h],'horizon':h,'actual':float(y[o+h].sum()),'predicted':float(pred.sum()),'warnings':forecast_warnings(pred,y[:o+1])})
                evaluation[method][split]={'metrics':error_metrics(rows),'rows':rows}
        chosen=min(METHODS,key=lambda m:evaluation[m]['validation']['metrics']['mae'])
        method_forecasts={}
        for method in METHODS:
            future=[]
            for h in range(1,13):
                p=prediction(y,months,len(y)-1,h,method,reps);errors=[abs(r['actual']-r['predicted']) for r in evaluation[method]['validation']['rows'] if r['horizon']==h];width=float(np.quantile(errors,.90,method='higher'));total=float(p.sum())
                future.append({'month':str(pd.Period(monthly[-1],freq='M')+h),'horizon':h,'predicted':total,'lower':max(0.,total-width),'upper':total+width,'sectors':dict(zip(FEATURES,map(float,p))),'warnings':forecast_warnings(p,y)})
            fp=np.array([list(r['sectors'].values()) for r in future]);fz=bundle['transform'].transform(np.log1p(pd.DataFrame(fp,columns=FEATURES)));labs=bundle['models']['gmm'].predict(fz)
            for row,k in zip(future,labs):row['profile_cluster']=int(k)
            method_forecasts[method]=future
        result[country]={'data_warnings':[r for r in quality['flags'] if r['country']==country],'selected':chosen,'evaluation':evaluation,'forecasts':method_forecasts[chosen],'method_forecasts':method_forecasts,'history':[{'month':r.month,'observed':float(r.total_co2),**{f:float(getattr(r,f)) for f in FEATURES}} for r in frame.itertuples()], 'beats_seasonal_test':evaluation[chosen]['test']['metrics']['mae']<evaluation['seasonal']['test']['metrics']['mae']}
        print('Forecast ready',country,chosen,flush=True)
    report={'countries':result,'methods':METHODS,'unit':'million tonnes CO₂ per month','target':audit['target'],'data_end':audit['end_date'],'source_sha256':audit['source_sha256'],'code_sha256':sha(Path(__file__)),'generated_at':datetime.now(timezone.utc).isoformat(),'validation_origins':[monthly[o] for o in validation_origins],'test_origins':[monthly[o] for o in test_origins],'interval_note':'Indicative range from four historical validation errors at the same horizon; not a calibrated confidence interval.','revision_note':'Corrected edition after prior test results were inspected. Same date windows are retained for debugging comparability; this rerun is not a newly untouched final test. No alpha or model choices were tuned to test errors. Sector-history control added to separate input information from representation effects.','protocol':'Select lowest validation MAE over 12-month horizons. Evaluate on later rolling origins without reselection. Refit direct horizon-specific Ridge models on all available history. Unit 3 transforms frozen at December 2022; regression scalers fit only within each training window.'}
    write(ROOT/'artifacts/forecast.json',report)
    flat=[{'country':c,'month':f['month'],'forecast_co2_mt':f['predicted'],'indicative_lower_mt':f['lower'],'indicative_upper_mt':f['upper'],'method':item['selected'],'source_review_required':bool(item['data_warnings']),'extrapolation_review_required':bool(f['warnings']),'review_notes':' | '.join(f['warnings']),**f['sectors']} for c,item in result.items() for f in item['forecasts']]
    pd.DataFrame(flat).to_csv(ROOT/'data/forecasts.csv',index=False,float_format='%.9f')
    return report

def forecast_warnings(values,history):
    warnings=[]
    total=float(np.sum(values));maximum=float(history.sum(axis=1).max())
    if total>3*maximum and total-maximum>=1:
        warnings.append('Total exceeds three times the largest observed monthly total; extrapolation requires review.')
    for index,feature in enumerate(FEATURES):
        maximum=float(history[:,index].max())
        if values[index]>3*maximum and values[index]-maximum>=1:
            warnings.append(feature+': exceeds three times its historical monthly maximum.')
    return warnings

def prepare_snapshot():
    from ml.quality import validate_snapshot,quality_report
    audit=json.loads((ROOT/'artifacts/audit.json').read_text())
    d,daily=validate_snapshot(ROOT,audit)
    raw=ROOT/'datasets/raw/carbon_monitor.csv'
    audit.update(daily_sha256=sha(ROOT/'data/clean_daily.csv'),
        provenance_status='original_source_verified' if raw.exists() and sha(raw)==audit['source_sha256'] else 'derived_snapshot_only',
        provenance_note='Daily and monthly exports are internally verified. Original source-byte authenticity is independently verifiable only when the original raw snapshot with the recorded SHA-256 is supplied.')
    quality=quality_report(d)
    write(ROOT/'artifacts/data_quality.json',quality)
    audit['quality_flags']=len(quality['flags']);audit['countries_with_flags']=quality['countries_with_flags']
    write(ROOT/'artifacts/audit.json',audit)
    return d,audit

def main():
    parser=argparse.ArgumentParser()
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--source',type=Path)
    group.add_argument('--from-clean',action='store_true',help='Rebuild from included derived CSV snapshot; does not verify original source bytes.')
    args=parser.parse_args()
    with threadpool_limits(limits=1):
        if args.source:
            clean(args.source)
            import shutil
            raw=ROOT/'datasets/raw/carbon_monitor.csv';raw.parent.mkdir(parents=True,exist_ok=True)
            if args.source.resolve()!=raw.resolve():shutil.copy2(args.source,raw)
        d,audit=prepare_snapshot();print('CLEAN',audit['monthly_rows'],audit['countries'],audit['end_date'],flush=True)
        bundle,research=cluster_research(d);forecast=forecasting(d,bundle,audit)
        print('DONE INDIA',forecast['countries']['India']['selected'],flush=True)
if __name__=='__main__':main()
