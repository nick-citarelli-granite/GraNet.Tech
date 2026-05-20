# GraNet.Tech Contact Endpoint

This is the first-party contact endpoint for the static site. It uses only Node.js built-ins and stores requests as JSON lines on disk.

Run it on a server you control:

```powershell
$env:PORT = "8788"
$env:CONTACT_REQUESTS_FILE = "D:\granetsite\data\contact-requests.jsonl"
node server\contact-server.mjs
```

The website posts to:

```text
/api/contact
```

The website checks endpoint availability at:

```text
/api/contact/health
```

If the static site is served by GitHub Pages, configure DNS/proxy infrastructure so `https://granet.tech/api/contact` and `https://granet.tech/api/contact/health` are routed to this Node process. The static files can still stay on GitHub Pages; only `/api/contact*` needs to hit the first-party backend.

Expected request body:

```json
{
  "name": "Customer Name",
  "email": "customer@example.com",
  "phone": "phone number",
  "message": "Request details",
  "website": ""
}
```

`website` is a honeypot field. If it is filled, the endpoint returns success but does not store the request.
