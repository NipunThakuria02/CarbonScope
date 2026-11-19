"""Serve the CarbonScope API and the built website on one origin."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .api import router
from .storage import DIST, check_exports, state


@asynccontextmanager
async def lifespan(app: FastAPI):
    check_exports()
    state()
    yield


app = FastAPI(title='CarbonScope Explorer', version='3.1', lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=4)
app.include_router(router)


@app.exception_handler(HTTPException)
async def api_error(request, error):
    return JSONResponse(status_code=error.status_code, content={'error': str(error.detail)})


@app.middleware('http')
async def set_cache_headers(request, call_next):
    response = await call_next(request)
    path = request.url.path
    response.headers['X-CarbonScope-Release'] = 'explorer-motion-v2'
    if path == '/' or path.endswith('.html') or path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store'
    elif path.startswith('/assets/') and response.status_code in (200, 304):
        response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    return response


if (DIST / 'index.html').is_file():
    app.mount('/', StaticFiles(directory=DIST, html=True), name='website')
else:
    @app.get('/', include_in_schema=False)
    def missing_website():
        raise HTTPException(503, 'Frontend build is missing. Run npm ci and npm run build in frontend, then restart.')
