import { createServer } from 'node:http';
import { mkdir, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const PORT = Number(process.env.PORT || 8788);
const REQUESTS_FILE = resolve(process.env.CONTACT_REQUESTS_FILE || './data/contact-requests.jsonl');
const MAX_BODY_BYTES = 12_000;

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function html(res, status, body) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GraNet.Tech Contact</title><style>body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f8fc;color:#07111f}.box{max-width:34rem;padding:2rem;border:1px solid #d7e2ec;border-radius:8px;background:#fff}a{color:#0b3f73;font-weight:700}</style></head><body><main class="box">${body}</main></body></html>`);
}

function wantsJson(req) {
  return String(req.headers.accept || '').includes('application/json');
}

function readBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let size = 0;
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejectBody(new Error('Request body too large'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => resolveBody(body));
    req.on('error', rejectBody);
  });
}

function parsePayload(req, body) {
  const type = req.headers['content-type'] || '';
  if (type.includes('application/json')) {
    return JSON.parse(body || '{}');
  }
  if (type.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(body));
  }
  throw new Error('Unsupported content type');
}

function clean(value) {
  return String(value || '').trim().slice(0, 2000);
}

function validate(payload) {
  const email = clean(payload.email);
  const phone = clean(payload.phone);
  const request = {
    createdAt: new Date().toISOString(),
    name: clean(payload.name),
    email,
    phone,
    contact: email || phone,
    message: clean(payload.message),
    website: clean(payload.website),
  };

  if (request.website) {
    return { request, spam: true };
  }
  if (!request.name || !request.email || !request.message) {
    throw new Error('Missing required fields');
  }
  return { request, spam: false };
}

async function saveRequest(request) {
  await mkdir(dirname(REQUESTS_FILE), { recursive: true });
  await appendFile(REQUESTS_FILE, `${JSON.stringify(request)}\n`, 'utf8');
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/api/contact/health')) {
    json(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/api/contact') {
    json(res, 404, { ok: false, error: 'Not found' });
    return;
  }

  try {
    const body = await readBody(req);
    const payload = parsePayload(req, body);
    const { request, spam } = validate(payload);

    if (!spam) {
      await saveRequest(request);
    }

    if (wantsJson(req)) {
      json(res, 200, { ok: true });
      return;
    }
    html(res, 200, '<h1>Request sent.</h1><p>GraNet will follow up soon.</p><p><a href="/#contact-panel">Back to GraNet.Tech</a></p>');
  } catch (error) {
    if (wantsJson(req)) {
      json(res, 400, { ok: false, error: error.message || 'Invalid request' });
      return;
    }
    html(res, 400, '<h1>Request was not sent.</h1><p>Please go back and make sure your name, email, and message are filled in.</p><p><a href="/#contact-panel">Back to GraNet.Tech</a></p>');
  }
});

server.listen(PORT, () => {
  console.log(`GraNet contact endpoint listening on http://127.0.0.1:${PORT}`);
  console.log(`Requests file: ${REQUESTS_FILE}`);
});
