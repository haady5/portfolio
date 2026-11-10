#!/usr/bin/env python3
"""
Static site generator for the Haaady Magdy portfolio.

Reads  : data/projects.json      (single source of truth)
Writes : assets/js/data.js       (browser copy of the data)
         projects/<slug>.html    (one static page per project)
         sitemap.xml

Run    : python3 build.py
"""

import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data", "projects.json")
OUT_JS = os.path.join(ROOT, "assets", "js", "data.js")
OUT_PAGES = os.path.join(ROOT, "projects")
SITEMAP = os.path.join(ROOT, "sitemap.xml")

DOMAIN = "https://haaadymagdy.com"


def esc(text):
    """Escape for HTML text nodes."""
    return (str(text).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


STACK_ICON = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
              'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
              '<rect x="3" y="3" width="12" height="12" rx="2"/><path d="M9 21h10a2 2 0 002-2V9"/></svg>')
ARROW_ICON = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
              'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
              '<path d="M7 17L17 7M9 7h8v8"/></svg>')
CARD_SIZES = "(max-width:679px) 100vw, (max-width:1059px) 50vw, 33vw"


def cover_of(project):
    for img in project["images"]:
        if img.get("cover"):
            return img
    return project["images"][0]


def filters_markup(data):
    """Static filter buttons - the labels exist in the i18n dictionary."""
    html = ('<button class="filter-btn active" data-filter="all" data-i18n="filter_all">'
            + esc(dict_fallback("filter_all")) + "</button>")
    for c in data["categories"]:
        key = "filter_" + c["id"]
        html += ('<button class="filter-btn" data-filter="' + c["id"] + '" data-i18n="' + key + '">'
                 + esc(c["ar"]) + "</button>")
    return html


def dict_fallback(key):
    return {"filter_all": "الكل"}[key]


def grid_markup(data):
    """The project cards are rendered into the static HTML so that the browser
    discovers the cover images immediately (huge LCP win on slow networks)
    and so the links exist for crawlers without JavaScript."""
    out = []
    for i, p in enumerate(data["projects"]):
        cover = cover_of(p)
        src = "images/projects/%s/%s" % (p["slug"], cover["cover"])
        src_m = "images/projects/%s/%s" % (p["slug"], cover["cover_m"])
        srcset = "%s %dw, %s %dw" % (src_m, cover["wm"], src, cover["cover_w"])
        cats = "".join('<span class="proj-cat">%s</span>' % esc(c["ar"])
                       for c in data["categories"] if c["id"] in p["categories"])
        out.append(
            '<a class="proj-card" href="projects/{slug}.html" style="--p-accent:{accent}"'
            ' data-cats="{cats_attr}"{featured}>'
            '<div class="proj-media">'
            '<img src="{src_m}" srcset="{srcset}" sizes="{sizes}" alt="{title}"'
            ' loading="lazy" decoding="async" width="{wm}" height="{hm}">'
            '<span class="proj-badge">{stack} {count} تصميم</span>'
            '<span class="proj-arrow">{arrow}</span>'
            '</div>'
            '<div class="proj-body">'
            '<span class="proj-kicker">{kicker}</span>'
            '<h3 class="proj-title">{title}</h3>'
            '<p class="proj-desc">{desc}</p>'
            '<div class="proj-foot"><div class="proj-cats">{cats}</div>'
            '<span class="proj-count">{year}</span></div>'
            '</div></a>'.format(
                slug=p["slug"], accent=p["accent"],
                cats_attr=" ".join(p["categories"]),
                featured=' data-featured="1"' if i == 0 else "",
                src=src, src_m=src_m, srcset=srcset, sizes=CARD_SIZES,
                wm=cover["wm"], hm=cover["hm"],
                title=esc(p["title_ar"]), stack=STACK_ICON,
                count=p["count"], arrow=ARROW_ICON,
                kicker=esc(p["kicker_ar"]), desc=esc(p["desc_ar"]),
                cats=cats, year=esc(p["year"]),
            )
        )
    return "\n".join(out)


def inject_index(data):
    """Write the generated blocks into index.html (between the markers)."""
    index = os.path.join(ROOT, "index.html")
    html = open(index, encoding="utf-8").read()
    blocks = [("FILTERS", filters_markup(data)),
              ("GRID", grid_markup(data))]
    for name, content in blocks:
        pattern = re.compile(
            r"(<!-- " + name + r":START -->).*?(<!-- " + name + r":END -->)",
            re.S)
        if not pattern.search(html):
            raise SystemExit("marker missing in index.html: " + name)
        html = pattern.sub(
            lambda m: m.group(1) + "\n" + content + "\n      " + m.group(2),
            html)
    open(index, "w", encoding="utf-8").write(html)
    return len(html)


def write_robots(data):
    lines = ["User-agent: *", "Allow: /", "", "Sitemap: %s/sitemap.xml" % DOMAIN, ""]
    with open(os.path.join(ROOT, "robots.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


def sync_index_domain():
    """Keep the canonical / Open Graph URLs of the home page in sync with DOMAIN."""
    index = os.path.join(ROOT, "index.html")
    html = open(index, encoding="utf-8").read()
    changed = False
    for old in ("https://haaadymagdy.com", "https://haady5.github.io/portfolio"):
        if old != DOMAIN and old in html:
            html = html.replace(old, DOMAIN)
            changed = True
    if changed:
        open(index, "w", encoding="utf-8").write(html)
    return changed


def read_data():
    with open(DATA, encoding="utf-8") as fh:
        return json.load(fh)


def write_js(data):
    os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    with open(OUT_JS, "w", encoding="utf-8") as fh:
        fh.write("/* AUTO-GENERATED from data/projects.json by build.py - do not edit by hand */\n")
        fh.write("window.HAAADY_PROJECTS = " + payload + ";\n")
    return len(payload)


PRESCRIPT = """<meta charset="UTF-8">
<script>
/* Applies saved theme/language before first paint - avoids a flash of the wrong styling. */
(function(){
  try{
    var lang = localStorage.getItem('haaady_lang') || 'ar';
    var theme = localStorage.getItem('haaady_theme') || 'dark';   /* DARK IS THE DEFAULT */
    var html = document.documentElement;
    html.classList.remove('no-js');
    html.setAttribute('lang', lang);
    html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    html.setAttribute('data-theme', theme);
  }catch(e){}
})();
</script>
"""


def head(project=None, base="../", jsonld=""):
    """Shared <head> block."""
    if project:
        title_ar = "%s — أعمال هادي مجدي" % project["title_ar"]
        title_en = "%s — Haaady Magdy Portfolio" % project["title_en"]
        desc_ar = project["desc_ar"]
        desc_en = project["desc_en"]
        canonical = "%s/projects/%s.html" % (DOMAIN, project["slug"])
        og_image = "%s/images/projects/%s/%s" % (DOMAIN, project["slug"], project["images"][0]["file"])
    else:
        title_ar = "هادي مجدي | مصمم جرافيك محترف — هوية بصرية، شعارات، سوشيال ميديا"
        title_en = "Haaady Magdy | Professional Graphic Designer — Branding, Logos, Social Media"
        desc_ar = ("هادي مجدي، مصمم جرافيك بخبرة 3+ سنوات وأكثر من 300 تصميم منفذ لأكثر من 50 عميل. "
                   "تصفّح مشاريع كاملة: هوية بصرية، سوشيال ميديا، حملات إعلانية وواجهات UI/UX.")
        desc_en = ("Haaady Magdy, a graphic designer with 3+ years of experience and 300+ designs delivered "
                   "for 50+ clients. Browse complete projects: branding, social media, ad campaigns and UI/UX.")
        canonical = DOMAIN + "/"
        og_image = DOMAIN + "/images/hero.webp"

    return PRESCRIPT + """<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title_ar}</title>
<meta name="description" content="{desc_ar}">
<meta name="keywords" content="مصمم جرافيك, تصميم هوية بصرية, سوشيال ميديا, حملات إعلانية, Graphic Designer, Haaady Magdy">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="author" content="Haaady Magdy">
<link rel="canonical" href="{canonical}">
<meta name="theme-color" content="#06080F">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Haaady Magdy">
<meta property="og:url" content="{canonical}">
<meta property="og:title" content="{title_ar}">
<meta property="og:description" content="{desc_ar}">
<meta property="og:image" content="{og_image}">
<meta property="og:locale" content="ar_AR">
<meta property="og:locale:alternate" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title_ar}">
<meta name="twitter:description" content="{desc_ar}">
<meta name="twitter:image" content="{og_image}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='24' fill='%235C86FF'/%3E%3Ctext x='50' y='68' font-family='Arial,sans-serif' font-weight='700' font-size='54' fill='white' text-anchor='middle'%3EH%3C/text%3E%3C/svg%3E">
<link rel="apple-touch-icon" href="{base}images/icon-180.png">
<link rel="icon" type="image/png" sizes="192x192" href="{base}images/icon-192.png">
<link rel="manifest" href="{base}manifest.json">
<link rel="stylesheet" href="{base}assets/css/style.css">
<link rel="preload" as="font" type="font/woff2" href="{base}assets/fonts/IBMPlexSansArabic-400-arabic.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="{base}assets/fonts/IBMPlexSansArabic-700-arabic.woff2" crossorigin>
{jsonld}""".format(
        title_ar=esc(title_ar),
        title_en=esc(title_en),
        desc_ar=esc(desc_ar),
        desc_en=esc(desc_en),
        canonical=canonical,
        og_image=og_image,
        base=base,
        jsonld="",
    ) + jsonld


NAVBAR = """
<a href="#main" class="skip-link" data-i18n="skip">تخطى إلى المحتوى</a>

<header class="navbar" id="navbar">
  <div class="container nav-inner">
    <a href="{home}#hero" class="logo" aria-label="Haaady Magdy">
      <span>Haaa<span>Dy</span></span>
      Magdy
    </a>
    <nav class="nav-links" aria-label="Main navigation">
      <a href="{home}#hero" data-i18n="nav_home">الرئيسية</a>
      <a href="{home}#work" data-i18n="nav_work">أعمالي</a>
      <a href="{home}#services" data-i18n="nav_services">الخدمات</a>
      <a href="{home}#about" data-i18n="nav_about">عني</a>
      <a href="{home}#contact" data-i18n="nav_contact">تواصل</a>
    </nav>
    <div class="nav-actions">
      <button class="icon-btn lang-btn" id="langToggle" aria-label="EN - Switch to English">EN</button>
      <button class="icon-btn" id="themeToggle" aria-label="Toggle dark mode">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      </button>
      <a href="{home}#contact" class="btn btn-primary btn-sm" data-i18n="nav_cta" style="display:none" id="navCta">ابدأ مشروعك</a>
      <button class="icon-btn burger" id="burgerBtn" aria-label="Open menu" aria-expanded="false">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
    </div>
  </div>
</header>

<div class="mobile-menu" id="mobileMenu">
  <div class="mobile-menu-top">
    <a href="{home}#hero" class="logo" aria-label="Haaady Magdy">HaaaDy Magdy</a>
    <button class="icon-btn" id="mobileCloseBtn" aria-label="Close menu">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  </div>
  <nav class="mobile-links" aria-label="Mobile navigation">
    <a href="{home}#hero" class="mobile-link" data-i18n="nav_home">الرئيسية</a>
    <a href="{home}#work" class="mobile-link" data-i18n="nav_work">أعمالي</a>
    <a href="{home}#services" class="mobile-link" data-i18n="nav_services">الخدمات</a>
    <a href="{home}#about" class="mobile-link" data-i18n="nav_about">عني</a>
    <a href="{home}#contact" class="mobile-link" data-i18n="nav_contact">تواصل</a>
  </nav>
  <div class="mobile-menu-foot">
    <a href="{home}#contact" class="btn btn-primary" data-i18n="nav_cta">ابدأ مشروعك</a>
    <div class="mobile-social">
      <a href="https://www.behance.net/haaady" target="_blank" rel="noopener" class="icon-btn" aria-label="Behance">Be</a>
      <a href="https://www.linkedin.com/in/haaady-magdy1/" target="_blank" rel="noopener" class="icon-btn" aria-label="LinkedIn">in</a>
      <a href="https://wa.me/201140634814" target="_blank" rel="noopener" class="icon-btn" aria-label="WhatsApp">WA</a>
    </div>
  </div>
</div>
"""

FOOTER = """
<footer>
  <div class="container">
    <div class="footer-top">
      <div class="footer-brand">
        <div class="logo">HaaaDy Magdy</div>
        <p data-i18n="footer_desc">مصمم جرافيك، بحوّل الأفكار لتصميمات تُرى وتُذكر.</p>
      </div>
      <div class="footer-col">
        <h4 data-i18n="footer_nav">التنقل</h4>
        <ul>
          <li><a href="{home}#hero" data-i18n="nav_home">الرئيسية</a></li>
          <li><a href="{home}#work" data-i18n="nav_work">أعمالي</a></li>
          <li><a href="{home}#services" data-i18n="nav_services">الخدمات</a></li>
          <li><a href="{home}#about" data-i18n="nav_about">عني</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4 data-i18n="footer_connect">تواصل</h4>
        <ul>
          <li><a href="https://www.behance.net/haaady" target="_blank" rel="noopener">Behance</a></li>
          <li><a href="https://www.linkedin.com/in/haaady-magdy1/" target="_blank" rel="noopener">LinkedIn</a></li>
          <li><a href="https://wa.me/201140634814" target="_blank" rel="noopener" data-i18n="contact_wa">واتساب</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© <span id="year"></span> Haaady Magdy — <span data-i18n="footer_rights">جميع الحقوق محفوظة</span></span>
      <div class="footer-toggles">
        <button class="icon-btn lang-btn" id="langToggle2" aria-label="EN - Switch to English">EN</button>
        <button class="icon-btn" id="themeToggle2" aria-label="Toggle dark mode">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        </button>
      </div>
    </div>
  </div>
</footer>

<a href="https://wa.me/201140634814?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%20Haaady%D8%8C%20%D8%A3%D8%B1%D9%8A%D8%AF%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1%20%D8%B9%D9%86%20%D9%85%D8%B4%D8%B1%D9%88%D8%B9%20%D8%AA%D8%B5%D9%85%D9%8A%D9%85." target="_blank" rel="noopener" class="wa-float" aria-label="WhatsApp">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.87.5 3.62 1.44 5.13L2 22l5.13-1.55a9.9 9.9 0 004.91 1.31h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2zm5.9 14.02c-.25.7-1.25 1.29-2.03 1.46-.55.12-1.26.21-3.63-.78-2.99-1.24-4.93-4.27-5.08-4.47-.14-.2-1.22-1.62-1.22-3.1s.77-2.19 1.05-2.49c.25-.27.55-.34.73-.34h.53c.17 0 .4-.03.62.47.25.6.86 2.08.93 2.23.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.02 1.12 1 2.06 1.31 2.36 1.46.3.15.47.12.65-.07.17-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.75.82 2.05.97.3.15.5.22.57.35.07.12.07.7-.18 1.4z"/></svg>
</a>

<script src="{base}assets/js/i18n.js"></script>
<script src="{base}assets/js/data.js"></script>
<script src="{base}assets/js/main.js"></script>
"""

LIGHTBOX = """
<div class="lbx" id="lbx" role="dialog" aria-modal="true" aria-label="Design preview">
  <button class="lbx-btn lbx-close" aria-label="Close">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
  </button>
  <button class="lbx-btn lbx-prev" aria-label="Previous design">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
  </button>
  <button class="lbx-btn lbx-next" aria-label="Next design">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
  </button>
  <div class="lbx-inner">
    <div class="lbx-stage">
      <img alt="">
    </div>
    <div class="lbx-meta">
      <div class="lbx-meta-txt">
        <div class="lbx-cat" data-i18n="nav_projects">المشاريع</div>
        <div class="lbx-title"></div>
      </div>
      <span class="lbx-count"></span>
    </div>
  </div>
</div>
"""


GALLERY_SIZES = "(max-width:359px) 100vw, (max-width:699px) 50vw, (max-width:1099px) 34vw, 25vw"
HERO_SIZES = "(max-width:979px) 92vw, 44vw"


def gallery_markup(project):
    tiles = []
    for i, img in enumerate(project["images"], start=1):
        src = "../images/projects/%s/%s" % (project["slug"], img["file"])
        src_m = "../images/projects/%s/%s" % (project["slug"], img["file_m"])
        srcset = "%s %dw, %s %dw" % (src_m, img["wm"], src, img["w"])
        tiles.append(
            '<button type="button" class="pp-tile reveal" '
            'data-src="{src}" data-alt="{alt}">'
            '<span class="pp-tile-num">{num:02d}</span>'
            '<img src="{src_m}" srcset="{srcset}" sizes="{sizes}" '
            'alt="{alt}" loading="lazy" decoding="async" width="{wm}" height="{hm}">'
            '<span class="pp-tile-cap">{alt}</span>'
            "</button>".format(
                src=src, src_m=src_m, srcset=srcset, sizes=GALLERY_SIZES,
                alt=esc(img["alt_ar"]), num=i,
                wm=img["wm"], hm=img["hm"],
            )
        )
    return "\n".join(tiles)


def jsonld(project):
    images = [
        {
            "@type": "ImageObject",
            "contentUrl": "%s/images/projects/%s/%s" % (DOMAIN, project["slug"], img["file"]),
            "width": img["w"],
            "height": img["h"],
            "caption": img["alt_ar"],
        }
        for img in project["images"]
    ]
    payload = {
        "@context": "https://schema.org",
        "@type": "ImageGallery",
        "name": project["title_ar"],
        "alternateName": project["title_en"],
        "description": project["desc_ar"],
        "url": "%s/projects/%s.html" % (DOMAIN, project["slug"]),
        "dateCreated": project["year"],
        "author": {
            "@type": "Person",
            "name": "Haaady Magdy",
            "url": DOMAIN + "/",
        },
        "about": project["kicker_ar"],
        "associatedMedia": images,
    }
    return ('<script type="application/ld+json">\n' +
            json.dumps(payload, ensure_ascii=False, indent=2) +
            "\n</script>\n")


def project_page(data, project, index):
    projects = data["projects"]
    prev = projects[(index - 1 + len(projects)) % len(projects)]
    next_ = projects[(index + 1) % len(projects)]
    cover = project["images"][0]
    cover_src = "../images/projects/%s/%s" % (project["slug"], cover["file"])
    cover_src_m = "../images/projects/%s/%s" % (project["slug"], cover["file_m"])
    cover_src_l = "../images/projects/%s/%s" % (project["slug"], cover["file_l"])
    cover_srcset = "%s %dw, %s %dw, %s %dw" % (
        cover_src_m, cover["wm"], cover_src_l, cover["wl"], cover_src, cover["w"])

    body_attrs = (
        'data-project="{slug}" '
        'data-title-ar="{t_ar}" data-title-en="{t_en}" '
        'data-desc-ar="{d_ar}" data-desc-en="{d_en}"'
    ).format(
        slug=project["slug"],
        t_ar=esc("%s — أعمال هادي مجدي" % project["title_ar"]),
        t_en=esc("%s — Haaady Magdy Portfolio" % project["title_en"]),
        d_ar=esc(project["desc_ar"]),
        d_en=esc(project["desc_en"]),
    )

    services = "".join('<span class="pp-service">%s</span>' % esc(s) for s in project["services_ar"])

    html = """<!DOCTYPE html>
<html lang="ar" dir="rtl" data-theme="dark" class="no-js">
<head>
{head}
</head>
<body {body_attrs}>

{navbar}

<main id="main">

  <section class="pp-hero" style="--p-accent:{accent}">
    <div class="container">
      <a class="pp-back" href="../index.html#work">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
        <span data-i18n="pp_back">رجوع للأعمال</span>
      </a>
      <div class="pp-hero-inner">
        <div class="pp-hero-copy">
          <span class="pp-kicker" data-p="kicker">{kicker}</span>
          <h1 data-p="title">{title}</h1>
          <p data-p="desc">{desc}</p>
          <div class="pp-services" data-p="services">{services}</div>
          <div class="pp-facts">
            <div class="pp-fact"><b data-p="client">{client}</b><span data-i18n="pp_client">العميل</span></div>
            <div class="pp-fact"><b data-p="count">{count}</b><span data-i18n="pp_count">عدد التصاميم</span></div>
            <div class="pp-fact"><b>{year}</b><span data-i18n="pp_year">السنة</span></div>
          </div>
          <div class="pp-cta">
            <a href="../index.html#contact" class="btn btn-primary">
              <span data-i18n="pp_cta_btn">ابدأ مشروعك</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </a>
            <a href="../index.html#work" class="btn btn-ghost" data-i18n="nav_work">أعمالي</a>
          </div>
        </div>
        <div class="pp-hero-media">
          <img src="{cover_src_l}" srcset="{cover_srcset}" sizes="{hero_sizes}"
               alt="{cover_alt}" width="{cover_w}" height="{cover_h}" fetchpriority="high">
        </div>
      </div>
    </div>
  </section>

  <section class="pp-gallery-section">
    <div class="container">
      <div class="pp-gallery-head">
        <div>
          <h2 data-i18n="pp_gallery">كل التصاميم</h2>
          <p data-i18n="pp_gallery_desc">اضغط على أي تصميم لعرضه بالحجم الكامل</p>
        </div>
        <span class="proj-count">{count} <span data-i18n="proj_designs">تصميم</span></span>
      </div>
      <div class="pp-gallery" id="ppGallery">
{gallery}
      </div>
    </div>
  </section>

  <section class="pp-nav">
    <div class="container">
      <div class="pp-nav-grid">
        <a class="pp-nav-card pp-nav-prev" href="{prev_url}">
          <span class="pp-nav-label">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
            <span data-i18n="pp_prev">المشروع السابق</span>
          </span>
          <h3 class="pp-nav-card-title">{prev_title}</h3>
          <p class="pp-nav-card-meta">{prev_meta}</p>
        </a>
        <a class="pp-nav-card pp-nav-next" href="{next_url}">
          <span class="pp-nav-label">
            <span data-i18n="pp_next">المشروع التالي</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </span>
          <h3 class="pp-nav-card-title">{next_title}</h3>
          <p class="pp-nav-card-meta">{next_meta}</p>
        </a>
      </div>

      <div class="pp-cta-band" style="--p-accent:{accent}">
        <div>
          <h3 data-i18n="pp_cta_title">عندك مشروع زي ده؟</h3>
          <p data-i18n="pp_cta_desc">قولي الفكرة وموعد التسليم، وأرد عليك في خلال 24 ساعة.</p>
        </div>
        <a href="../index.html#contact" class="btn btn-primary">
          <span data-i18n="pp_cta_btn">ابدأ مشروعك</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
      </div>
    </div>
  </section>

</main>

{lightbox}

{footer}
<script src="{base}assets/js/project.js"></script>
</body>
</html>
""".format(
        head=head(project, base="../", jsonld=jsonld(project)),
        body_attrs=body_attrs,
        navbar=NAVBAR.format(home="../index.html", base="../"),
        accent=project["accent"],
        kicker=esc(project["kicker_ar"]),
        title=esc(project["title_ar"]),
        desc=esc(project["desc_ar"]),
        services=services,
        client=esc(project["client_ar"]),
        count=project["count"],
        year=esc(project["year"]),
        cover_src=cover_src,
        cover_src_m=cover_src_l,
        cover_src_l=cover_src_l,
        cover_srcset=cover_srcset,
        hero_sizes=HERO_SIZES,
        cover_alt=esc(cover["alt_ar"]),
        cover_w=cover["w"],
        cover_h=cover["h"],
        gallery=gallery_markup(project),
        prev_url=prev["slug"] + ".html",
        next_url=next_["slug"] + ".html",
        prev_title=esc(prev["title_ar"]),
        next_title=esc(next_["title_ar"]),
        prev_meta=esc("%s · %d تصميم" % (prev["client_ar"], prev["count"])),
        next_meta=esc("%s · %d تصميم" % (next_["client_ar"], next_["count"])),
        lightbox=LIGHTBOX,
        footer=FOOTER.format(home="../index.html", base="../"),
        base="../",
    )
    return html


def write_sitemap(data):
    import datetime
    today = datetime.date.today().isoformat()
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    lines.append("  <url>")
    lines.append("    <loc>%s/</loc>" % DOMAIN)
    lines.append("    <lastmod>%s</lastmod>" % today)
    lines.append("    <changefreq>weekly</changefreq>")
    lines.append("    <priority>1.0</priority>")
    lines.append("  </url>")
    for p in data["projects"]:
        lines.append("  <url>")
        lines.append("    <loc>%s/projects/%s.html</loc>" % (DOMAIN, p["slug"]))
        lines.append("    <lastmod>%s</lastmod>" % today)
        lines.append("    <changefreq>monthly</changefreq>")
        lines.append("    <priority>0.8</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    with open(SITEMAP, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")


def main():
    data = read_data()

    size = write_js(data)
    print("assets/js/data.js  (%d bytes)" % size)

    os.makedirs(OUT_PAGES, exist_ok=True)
    for index, project in enumerate(data["projects"]):
        page = project_page(data, project, index)
        path = os.path.join(OUT_PAGES, project["slug"] + ".html")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(page)
        print("projects/%s.html  (%d designs)" % (project["slug"], project["count"]))

    write_sitemap(data)
    print("sitemap.xml  (%d urls)" % (len(data["projects"]) + 1))

    write_robots(data)
    if sync_index_domain():
        print("index.html   (domain synced to %s)" % DOMAIN)
    else:
        print("index.html   (domain already %s)" % DOMAIN)

    size = inject_index(data)
    print("index.html   (project grid injected, %d bytes)" % size)


if __name__ == "__main__":
    main()
