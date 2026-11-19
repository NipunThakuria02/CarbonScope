import re

from fastapi.testclient import TestClient

from backend.app.main import app


def test_site_and_api_cache_policy():
    with TestClient(app) as client:
        health = client.get('/api/v1/health')
        assert health.json()['status'] == 'ready'
        assert health.headers['cache-control'] == 'no-store'
        page = client.get('/')
        assert page.status_code == 200
        assert page.headers['cache-control'] == 'no-store'
        script = re.search(r'src="(/assets/[^"]+\.js)"', page.text).group(1)
        assert client.get(script).headers['cache-control'] == 'public, max-age=31536000, immutable'
        assert client.get('/api/country', headers={'Accept-Encoding': 'gzip'}).headers['content-encoding'] == 'gzip'
