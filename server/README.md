# GraNet.Tech Contact Endpoint

This is the planned first-party contact endpoint for the static site. The live static page currently posts to FormSubmit as a temporary free fallback until GraNet has a server available. This endpoint uses only Node.js built-ins and stores requests as JSON lines on disk.

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

If the static site is served by GitHub Pages, configure DNS/proxy infrastructure so `https://granet.tech/api/contact` is routed to this Node process. The static files can still stay on GitHub Pages; only `/api/contact` needs to hit the first-party backend.

Expected request body:

```json
{
  "name": "Customer Name",
  "contact": "phone or email",
  "message": "Request details",
  "website": ""
}
```

`website` is a honeypot field. If it is filled, the endpoint returns success but does not store the request.
