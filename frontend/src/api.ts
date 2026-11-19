export async function api(path: string, options?: RequestInit) {
  const response = await fetch('/api' + path, options);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('The CarbonScope API returned an unexpected response.');
  }
  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      body.error ?? 'The CarbonScope API could not complete the request.',
    );
  }
  return body;
}
