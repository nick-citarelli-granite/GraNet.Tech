# GraNet.Tech

Static homepage for GraNet State IT Solutions LLC.

## Project Layout

- `index.html` - production page markup and SEO metadata.
- `assets/css/styles.css` - site styling.
- `assets/js/app.js` - client-side panel, copy, analytics, and contact-form behavior.
- `assets/img/` - site logo, Open Graph image, Google review QR code, and PNG app icons.
- `tools/check-site.ps1` - validates required files, local links, JavaScript syntax, and install metadata.

Root files such as `CNAME`, `.nojekyll`, `favicon.ico`, `favicon.svg`, `site.webmanifest`, `robots.txt`, and `sitemap.xml` stay in the project root because GitHub Pages and browsers expect them there.

## Check

```powershell
powershell.exe -ExecutionPolicy Bypass -File tools\check-site.ps1
```
