# GraNet.Tech

Static, dependency-free GraNet IT Solutions website. The site is plain HTML,
CSS, and JavaScript and can be served by any static web server.

## Primary routes

- `/` — audience paths, service overview, and process
- `/services/` — business capability comparison
- `/software-ai-web/` — software, AI automation, and web development
- `/managed-it-security-cloud/` — managed IT, security, cloud, and devices
- `/repair-hourly-support/` — residential and hourly support
- `/contact/` — company, team, and Mercury Intake form

Existing individual team URLs remain available under `/contact/`.

## Local preview

You can open `index.html` directly without starting a server. Assets use
file-compatible relative paths, and `assets/js/site.js` adds explicit
`index.html` filenames to internal directory links only while running under
the `file:` protocol. A local HTTP server remains the closest production
preview.

## Mercury Public Website Intake

The form posts directly from the browser to Mercury's credential-free Public
Website Intake endpoint. It does not use a relay or expose a secret.

Before launch:

1. Deploy Mercury's `public_web` Intake implementation.
2. Create an active Public Website source with exact origin
   `https://granet.tech` and configure routing.
3. Replace `CONFIGURE_PUBLIC_IDENTIFIER` in
   `assets/js/contact-config.js` and `contact/index.html` with the source's
   public identifier.
4. Run the launch check shown below.
5. Submit one production test and confirm a single Contact Inbox record and
   the expected source/routing evidence.

The identifier is intentionally public. Do not add an Intake key, cookies,
credentials, or custom identity headers to the browser request.

## Server configuration

Include `tools/nginx-site-redirects.conf` in the canonical TLS server so legacy
service URLs return permanent redirects. Redirect the `www` host to
`https://granet.tech`.

Include `tools/nginx-security-headers.conf` as well. It contains the production
Content Security Policy, limits `connect-src` and `form-action` to Mercury's
deployed origin, and allowlists the inline JSON-LD blocks by hash. Regenerate
those hashes whenever structured data changes.

## Checks

```powershell
powershell.exe -ExecutionPolicy Bypass -File tools\check-site.ps1
powershell.exe -ExecutionPolicy Bypass -File tools\check-site.ps1 -RequireMercuryConfig
```

The first command validates the static artifact. The second is the launch gate
and fails while the Mercury public identifier is still a placeholder.

Generated cinematic PNG sources are retained by the image-generation system,
not in the deployed tree. Only optimized AVIF and WebP derivatives are tracked.
