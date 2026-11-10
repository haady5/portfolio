HaaaDy Magdy — Portfolio Website
=================================

A static, bilingual (AR / EN) designer portfolio. No build step is needed to
DEPLOY — drag the folder into Netlify, Vercel, Cloudflare Pages, GitHub Pages
or any cPanel/Apache host and it just works.


HOW IT IS ORGANISED
-------------------

  index.html              Home page (hero, services, project grid, about, contact)
  projects/               One static page per project (auto-generated)
      besat.html  wejhati.html  rox-ab.html  caspian.html  lixora.html

  assets/
      css/style.css       The whole design system + self hosted @font-face rules
      fonts/              IBM Plex Sans / IBM Plex Sans Arabic (subset woff2)
      js/i18n.js          AR + EN text
      js/data.js          Project data used by the browser (auto-generated)
      js/main.js          Theme, language, navbar, reveal, counters, brief form
      js/home.js          Renders the project grid + filters on the home page
      js/project.js       Project page: masonry gallery, lightbox, prev/next

  images/
      hero.webp  hero-620.webp  hero-320.webp   Haady.webp
      icon-180.png  icon-192.png  icon-512.png
      projects/<project-slug>/<name>.webp       full size (max 1400px)
      projects/<project-slug>/<name>-m.webp     medium (max 760px, used by srcset)
      projects/<project-slug>/<name>-c.webp     grid cover (max 900px)

  manifest.json           PWA manifest (add to home screen)
  .htaccess               gzip/brotli + cache headers (Apache / cPanel only)

  data/projects.json      >>> THE SINGLE SOURCE OF TRUTH <<<
  build.py                Generates projects/*.html, the project grid inside
                          index.html, assets/js/data.js and sitemap.xml
  tools/prepare_images.py Converts + organises the raw artwork into WebP
  tools/audit.js          Responsive audit (emulates 9 device profiles via CDP)
  tools/perf.js           Payload + Core Web Vitals per device profile
  tools/waterfall.js      Request waterfall of a single page
  tools/shoot.js          Screenshot of a single element at any viewport
  tools/raw/              Original artwork masters (safe to delete if you like)


PROJECTS (5 projects · 43 designs)
----------------------------------
  slug        client          designs  accent
  besat       بساط             14      purple
  wejhati     وجهتي             7      lime
  rox-ab      ROX x AB          4      silver
  caspian     كاسبيان          10      red
  lixora      لوكورا            8      orange


EDITING CONTENT
----------------
Everything about a project (title, client, description, category, images order)
lives in data/projects.json. Edit it, then regenerate the pages:

    python3 build.py

That rewrites:
    projects/*.html        (static pages - one per project)
    index.html             (the project grid + filter buttons)
    assets/js/data.js      (the copy the browser reads)
    sitemap.xml

If Python is not available, the generated files can also be hand-edited —
they are plain HTML/JS. Just keep data.js, index.html and projects/*.html
in sync.


ADDING A NEW PROJECT
--------------------
1. Put the images in  images/projects/<new-slug>/  as WebP (or any format).
2. Add an entry to  data/projects.json  with at least:
       slug, title_ar, title_en, client_ar, client_en, kicker_ar, kicker_en,
       categories, services_ar, services_en, year, accent, desc_ar, desc_en,
       cover, count, images[]  (each image: file, file_m, w, h, wm, hm,
       alt_ar, alt_en)
3. Run  python3 build.py
4. The new project appears on the home page, gets its own page, and is
   added to sitemap.xml automatically.

To regenerate the optimised images from the raw artwork:
    python3 tools/prepare_images.py


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
All strings live in assets/js/i18n.js. Project-specific strings live in
data/projects.json (both *_ar and *_en).


IMAGES & PERFORMANCE
---------------------
- Everything is WebP, in four sizes per image:
    <name>.webp    1400px  desktop + lightbox
    <name>-l.webp  1050px  large phones
    <name>-m.webp   760px  phones
    <name>-c.webp   640px  project cover (grid card)
- <img srcset>/<sizes> are used everywhere so every device downloads the
  smallest variant that still looks sharp on its screen.
- The fonts are self hosted (no request to fonts.googleapis.com) so the site
  works offline and behind firewalls, and no visitor IP leaks to Google.
- The project grid is rendered into the static HTML at build time, so the
  browser finds the cover images immediately (huge LCP win) and search
  engines get the links even without JavaScript.
- There is NO animation library - the hero entrance, the scroll reveals, the
  magnetic buttons and the 3D tilt are all ~40 lines of vanilla CSS/JS.
  That removed ~110 KB of third party JavaScript (GSAP) from every page.
- The whole site (43 project images included) is about 9 MB on disk, but a
  single page load pulls 265 KB on a Slow 4G phone.


DEPLOYING
---------
Static site, no server, no build. Upload the whole folder as-is.
After deploying:
  - update the domain in build.py (DOMAIN) and re-run  python3 build.py
  - the domain is also hard-coded in robots.txt, sitemap.xml and the
    <link rel="canonical"> / Open Graph tags inside the generated pages
  - Netlify / Vercel / Cloudflare handle compression + caching automatically.
    On Apache/cPanel the included .htaccess does it.


WHATSAPP NUMBER
----------------
Currently 01140634814 (Egypt, +20) -> 201140634814.
Search for "201140634814" in assets/js/main.js (the brief form) and in
index.html / build.py (the floating button + contact links).


CHECKING THE SITE
-----------------
    python3 tools/audit.js                       # responsive audit (9 devices x 3 pages)
    node tools/perf.js                           # payload + Core Web Vitals per device
    node tools/waterfall.js <baseUrl> /index.html 390 844   # request waterfall
    node tools/shoot.js <baseUrl> /index.html .hero out.png 390 844   # element screenshot

LATEST RESULTS (gzip enabled, throttled network + CPU)
------------------------------------------------------
  Lighthouse mobile   home: perf 97 | a11y 100 | best practices 100 | SEO 100
                      project pages: perf 98-99 | a11y 100 | best practices 100 | SEO 100
                      FCP 0.8-1.7s | LCP 2.1-2.4s | TBT 0ms | CLS 0
  Lighthouse desktop  home: perf 100 | a11y 100 | best practices 100 | SEO 100
                      project pages: perf 99-100 | a11y 100 | best practices 100 | SEO 100
                      FCP 0.2-0.4s | LCP 0.5-0.8s | TBT 0ms | CLS 0.004

  Responsive audit   27/27 device + page combinations clean
                     (no horizontal overflow, no broken images, no missing alt
                      text, no JS errors, tap targets >= 40px)

  Cold load on a Slow 4G phone
                     home page:  ~265 KB  (html 10 KB, css 9 KB, js 17 KB,
                                          fonts 189 KB, hero 37 KB)
                     project:    ~500 KB  + the project images on scroll

  The fonts are the largest single item. They are cached permanently by the
  browser, so only the very first visit pays for them.


NOTES
-----
- The project grid and the filter buttons are rendered with JavaScript from
  data.js, so there is no fallback list of projects if JS is off.
  A static <noscript> list of the project links sits inside the portfolio
  section as a safety net.
- The gallery is a true masonry layout (row spans are computed in JS), so
  portrait and square designs sit flush against each other with no gaps.
- Captions on the gallery are always visible on touch devices (no hover).
