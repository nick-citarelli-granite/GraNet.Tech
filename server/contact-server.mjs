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
  const request = {
    createdAt: new Date().toISOString(),
    name: clean(payload.name),
    contact: clean(payload.contact),
    message: clean(payload.message),
    website: clean(payload.website),
  };

  if (request.website) {
    return { request, spam: true };
  }
  if (!request.name || !request.contact || !request.message) {
    throw new Error('Missing required fields');
  }
  return { request, spam: false };
}

async function saveRequest(request) {
  await mkdir(dirname(REQUESTS_FILE), { recursive: true });
  await appendFile(REQUESTS_FILE, `${JSON.stringify(request)}\n`, 'utf8');
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
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

    json(res, 200, { ok: true });
  } catch (error) {
    json(res, 400, { ok: false, error: error.message || 'Invalid request' });
  }
});

server.listen(PORT, () => {
  console.log(`GraNet contact endpoint listening on http://127.0.0.1:${PORT}`);
  console.log(`Requests file: ${REQUESTS_FILE}`);
});
