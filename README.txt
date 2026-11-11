HaaaDy Magdy — Portfolio Website
=================================

A static, bilingual (AR / EN) designer portfolio. No build step is needed to
DEPLOY — drag the folder into Netlify, Vercel, Cloudflare Pages, GitHub Pages
or any cPanel/Apache host and it just works.


HOW IT IS ORGANISED
-------------------

  index.html              Home page (hero, services, project grid, about, contact)
  projects/               One static page per project
      besat.html  wejhati.html  rox-ab.html  fast-food.html  lixora.html

  assets/
      css/style.css       The whole design system + self hosted @font-face rules
      fonts/              IBM Plex Sans / IBM Plex Sans Arabic (subset woff2)
      js/i18n.js          AR + EN text
      js/data.js          The project data the browser reads
      js/main.js          Theme, language, navbar, reveal, counters, brief form
      js/home.js          Filter behaviour for the project grid
      js/project.js       Project page: masonry gallery, lightbox, prev/next

  images/
      hero.webp  hero-900.webp  hero-620.webp  hero-320.webp   Haady.webp
      Haady-760.webp  Haady-480.webp
      icon-180.png  icon-192.png  icon-512.png
      projects/<project-slug>/<name>.webp       full size (max 1400px)
      projects/<project-slug>/<name>-l.webp     large  (max 1050px)
      projects/<project-slug>/<name>-m.webp     medium (max 760px)
      projects/<project-slug>/<name>-c.webp     cover  (max 640px)

  manifest.json           PWA manifest (add to home screen)
  .htaccess               gzip/brotli + cache headers (Apache / cPanel only)
  .nojekyll               lets GitHub Pages serve the files as they are


PROJECTS (5 projects · 43 designs)
----------------------------------
  slug        client          designs  accent
  besat       بساط             14      purple
  wejhati     وجهتي             7      lime
  rox-ab      ROX x AB          4      silver
  fast-food   فاست فود         10      red
  lixora      ليكورا            8      orange


THEME
-----
DARK IS THE DEFAULT. The visitor's OS setting is ignored on purpose.
The choice is saved in localStorage under "haaady_theme".
To change the default, edit the "dark" default in assets/js/main.js and in
the inline script in the <head> of index.html + projects/*.html.

Both themes are defined with CSS custom properties at the top of
assets/css/style.css — :root is the dark palette, html[data-theme="light"]
overrides it.


LANGUAGE
--------
Arabic is the default, English is one click away (RTL <-> LTR is automatic).
All shared strings live in assets/js/i18n.js. The project names, descriptions
and image captions live in assets/js/data.js (both *_ar and *_en).


IMAGES & PERFORMANCE
---------------------
- Everything is WebP, in four sizes per image (1400 / 1050 / 760 / 640).
- <img srcset>/<sizes> are used everywhere so every device downloads the
  smallest variant that still looks sharp on its screen.
- The fonts are self hosted (no request to fonts.googleapis.com) so the site
  works offline and behind firewalls, and no visitor IP leaks to Google.
- The project grid is rendered into the static HTML, so the browser finds the
  cover images immediately (huge LCP win) and search engines get the links
  even without JavaScript.
- There is NO animation library - the hero entrance, the scroll reveals, the
  magnetic buttons and the 3D tilt are all ~40 lines of vanilla CSS/JS.
  That removed ~110 KB of third party JavaScript (GSAP) from every page.
- The whole site (43 project images included) is about 10 MB on disk, but a
  single page load pulls 265 KB on a Slow 4G phone.


DEPLOYING
---------
Static site, no server, no build. Upload the whole folder as-is.

  GitHub Pages   Settings -> Pages -> Deploy from a branch -> main / (root)
  Netlify        drag the folder onto app.netlify.com/drop
  Vercel         vercel deploy --prod
  cPanel         upload to public_html (the .htaccess handles compression
                 and cache headers for you)

After deploying, update the domain in the canonical + Open Graph tags:
  index.html  and  projects/*.html  ->  https://haaadymagdy.com
  robots.txt  and  sitemap.xml
(they are plain text, a find & replace is enough)

WHATSAPP NUMBER
----------------
Currently 01140634814 (Egypt, +20) -> 201140634814.
Search for "201140634814" in assets/js/main.js (the brief form) and in
index.html / projects/*.html (the floating button + contact links).


QUALITY CHECKS
--------------
  Lighthouse mobile   home: perf 97 | a11y 100 | best practices 100 | SEO 100
                      project pages: perf 98-99 | a11y 100 | best practices 100 | SEO 100
                      FCP 0.8-1.7s | LCP 2.1-2.4s | TBT 0ms | CLS 0
  Lighthouse desktop  home: perf 100 | a11y 100 | best practices 100 | SEO 100
                      project pages: perf 99-100 | a11y 100 | best practices 100 | SEO 100
                      FCP 0.2-0.4s | LCP 0.5-0.8s | TBT 0ms | CLS 0.004

  Responsive         27/27 device + page combinations clean (9 device profiles
                     x 3 pages): no horizontal overflow, no broken images, no
                     missing alt text, no JS errors, tap targets >= 40px

  All 249 local links resolve, every image has an alt text, every page has a
  canonical URL, Open Graph card and JSON-LD.


NOTES
-----
- The project grid and the filter buttons are rendered with JavaScript from
  data.js, so there is no fallback list of projects if JS is off.
  A static <noscript> list of the project links sits inside the portfolio
  section as a safety net.
- The gallery is a true masonry layout (row spans are computed in JS), so
  portrait and square designs sit flush against each other with no gaps.
- Captions on the gallery are always visible on touch devices (no hover).
- The "build-sources" branch of this repository keeps the build tooling
  (build.py, the project source data and the audit scripts) for whoever
  needs to regenerate the site after editing the content.
