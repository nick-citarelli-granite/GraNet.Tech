# GraNet.Tech

Static homepage for GraNet State IT Solutions LLC.

## Project Layout

- `index.html` - production page markup and SEO metadata.
- `assets/css/styles.css` - site styling.
- `assets/js/app.js` - client-side panel, copy, analytics, and contact-form behavior.
- `assets/img/` - site logo, Open Graph image, and PNG app icons.
- `tools/check-site.ps1` - validates required files, local links, JavaScript syntax, and install metadata.

Root files such as `CNAME`, `.nojekyll`, `favicon.ico`, `site.webmanifest`, `robots.txt`, and `sitemap.xml` stay in the project root because GitHub Pages and browsers expect them there.

## Check

```powershell
powershell.exe -ExecutionPolicy Bypass -File tools\check-site.ps1
```

## Contact API Deployment Notes

The static contact form posts JSON to `/api/contact`. The production Ruby/Sinatra
API should enforce server-side validation and abuse checks before sending mail.

Recommended Nginx rate limit guidance for the live server:

```nginx
# nginx.conf, inside the http block
limit_req_zone $binary_remote_addr zone=contact_api:10m rate=3r/m;

# site config, inside the /api/contact location
limit_req zone=contact_api burst=5 nodelay;
```

Do not deploy these snippets from the static-site build. Apply them only while
working directly on the VPS Nginx configuration.
