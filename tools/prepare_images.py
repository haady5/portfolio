#!/usr/bin/env python3
"""
One-off image preparation for the Haaady Magdy portfolio.

Reads the raw artwork (images/*.webp + new/*.jpeg), converts everything to
optimised WebP, and lays it out per project:

    images/projects/<project-slug>/01-....webp      full size (max 1600px)
    images/projects/<project-slug>/01-....-c.webp   grid cover  (max 900px)

It also (re)writes data/projects.json which is the single source of truth
for the whole site.

Run:  python3 tools/prepare_images.py
"""

import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "images")
OUT = os.path.join(IMG, "projects")
DATA = os.path.join(ROOT, "data", "projects.json")

MAX_FULL = 1400
MAX_LARGE = 1050
MAX_MED = 760
MAX_COVER = 640
QUALITY_FULL = 72
QUALITY_MED = 72
QUALITY_COVER = 74

# ---------------------------------------------------------------------------
# source map:  (project slug, output filename, source file, alt ar, alt en)
# ---------------------------------------------------------------------------
SOURCES = {
    "besat": [
        ("01-launch-4-packages", "tools/raw/legacy/1.webp",
         "إعلان إطلاق 4 باقات جديدة لمنصة بساط", "Besat launch of 4 new subscription packages"),
        ("02-foundation-package", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.03.18 PM (1).jpeg",
         "باقة التأسيس لمنصة بساط", "Besat foundation package"),
        ("03-training-package", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.03.18 PM (2).jpeg",
         "باقة التدريب لمنصة بساط", "Besat training package"),
        ("04-integrated-package", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.03.18 PM (3).jpeg",
         "الباقة المتكاملة لمنصة بساط", "Besat integrated package"),
        ("05-institutions-package", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.03.18 PM (4).jpeg",
         "باقة المؤسسات لمنصة بساط", "Besat institutions package"),
        ("06-needs-laptop", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.03.18 PM (5).jpeg",
         "تصميم باقة على شاشة لابتوب", "Package design shown on a laptop screen"),
        ("07-training-dashboard", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.03.18 PM.jpeg",
         "باقة كل مشروع تدريبي مع لوحة التحكم", "Training project package with dashboard"),
        ("08-subscriptions-package", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.03.19 PM (1).jpeg",
         "باقة الاشتراكات لمنصة بساط", "Besat subscriptions package"),
        ("09-training-package-story", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.03.19 PM (2).jpeg",
         "باقة التدريب ضمن سلسلة الإعلانات", "Training package in a campaign series"),
        ("10-integrated-package-story", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.03.19 PM (3).jpeg",
         "الباقة المتكاملة ضمن سلسلة الإعلانات", "Integrated package in a campaign series"),
        ("11-institutions-package-story", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.03.19 PM (4).jpeg",
         "باقة المؤسسات ضمن سلسلة الإعلانات", "Institutions package in a campaign series"),
        ("12-whatever-you-need", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.03.19 PM (5).jpeg",
         "تصميم أيا كان احتياجك في بسط", "Whatever you need campaign design"),
        ("13-every-training-project", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.03.19 PM.jpeg",
         "تصميم كل مشروع تدريبي له باقة", "Every training project gets its own package"),
        ("14-dashboard-ui", "tools/raw/legacy/2.webp",
         "واجهة اختيار الباقة داخل منصة بساط", "Package chooser interface inside Besat"),
    ],
    "wejhati": [
        ("01-app-launch", "tools/raw/legacy/4.webp",
         "إعلان إطلاق تطبيق وجهتي لحجز الرحلات", "Wejhati travel booking app launch ad"),
        ("02-book-easy", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.04.08 PM.jpeg",
         "تصميم احجز رحلتك على كيفك", "Book your trip the easy way"),
        ("03-travel-device", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.04.09 PM (1).jpeg",
         "تصميم حجز الرحلة من جهازك", "Book a trip from your own device"),
        ("04-start-journey", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.04.09 PM (2).jpeg",
         "تصميم من هنا تبدأ الرحلة", "This is where your journey starts"),
        ("05-discover-ben-bak", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.04.09 PM (3).jpeg",
         "تصميم اكتشف بن بك", "Discover Ben Bak"),
        ("06-to-the-airport", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.04.09 PM (4).jpeg",
         "تصميم من الطريق إلى المطار", "From the road to the airport"),
        ("07-without-numbers", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.04.09 PM.jpeg",
         "تصميم بدون أرقام وبدون قيود", "No numbers, no limits"),
    ],
    "rox-ab": [
        ("01-rox-launch", "tools/raw/legacy/3.webp",
         "حملة إعلانية فاخرة لسيارات ROX", "Luxury ad campaign for ROX cars"),
        ("02-cost-reduction-vr", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.04.46 PM (1).jpeg",
         "تصميم خفض التكلفة بتقنية الواقع الافتراضي", "Cost reduction shown in VR"),
        ("03-vision-into-experience", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.04.46 PM (2).jpeg",
         "تصميم تحويل الرؤية إلى تجربة", "Turning vision into experience"),
        ("04-making-the-launch-count", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.04.46 PM.jpeg",
         "تصميم إطلاق الحملة بنجاح", "Making the launch count"),
    ],
    "caspian": [
        ("01-food-no-alternative", "tools/raw/legacy/5.webp",
         "حملة مطعم كاسبيان: الطعام ملوش بديل", "Caspian restaurant: food has no alternative"),
        ("02-traditional-taste", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.05.42 PM (1).jpeg",
         "تصميم تقمص واصدق غير المزة", "Traditional taste campaign design"),
        ("03-from-the-table", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.05.42 PM (2).jpeg",
         "تصميم معاك قرش كل مشترياتك", "Get a pound off every order"),
        ("04-delicious-food", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.05.42 PM (3).jpeg",
         "تصميم طعام مميز", "Delicious food design"),
        ("05-authentic-menu", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.05.42 PM (4).jpeg",
         "تصميم أكلك عندنا متشيك", "Authentic food menu design"),
        ("06-where-to-start", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.05.42 PM (5).jpeg",
         "تصميم دليلي من أين أبدأ", "A guide to where to start"),
        ("07-menu-wheel", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.05.42 PM (6).jpeg",
         "تصميم عجلة أقوى طعم في البلدة", "Strongest flavour in town campaign"),
        ("08-order-now", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.05.42 PM (7).jpeg",
         "تصميم أطلب دلوقتي", "Order now campaign design"),
        ("09-order-ready", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.05.42 PM (8).jpeg",
         "تصميم طلبك جاهز", "Your order is ready"),
        ("10-taste-in-every-bite", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.05.42 PM.jpeg",
         "تصميم ذوقك في كل لقمة", "Taste in every bite"),
    ],
    "lixora": [
        ("01-social-media-pack", "tools/raw/legacy/6.webp",
         "باقة 20+ تصميم سوشيال ميديا للوكورا", "Lixora social media pack of 20+ designs"),
        ("02-skincare-lineup", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.06.11 PM.jpeg",
         "تصميم تشكيلة منتجات العناية بالبشرة", "Skincare product lineup design"),
        ("03-brand-story", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.06.12 PM (1).jpeg",
         "تصميم حكاية علامة لوكورا", "Lixora brand story design"),
        ("04-product-lifestyle", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.06.12 PM (2).jpeg",
         "تصميم منتجات العناية بالبشرة في الاستخدام اليومي", "Daily skincare product design"),
        ("05-gift-set", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.06.12 PM (3).jpeg",
         "تصميم عروض مجموعة الهدايا", "Gift set offer design"),
        ("06-detail-shot", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.06.12 PM (4).jpeg",
         "تصميم القطعة اللي بتلمع عينيها", "Close-up product detail design"),
        ("07-summer-offer", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.06.12 PM (5).jpeg",
         "تصميم عرض اشترِ 2 واحصل على الثالث مجاناً", "Buy 2 get 1 offer design"),
        ("08-campaign-collage", "tools/raw/new/WhatsApp Image 2026-11-10 at 5.06.12 PM.jpeg",
         "ملخص منشورات حملة لوكورا", "Lixora campaign post collage"),
    ],
}

# ---------------------------------------------------------------------------
# project metadata
# ---------------------------------------------------------------------------
PROJECTS = [
    {
        "slug": "besat",
        "title_ar": "بساط | نظام باقات الاشتراك",
        "title_en": "Besat | Subscription package system",
        "client_ar": "بساط",
        "client_en": "Besat",
        "kicker_ar": "منصة تعليمية رقمية",
        "kicker_en": "Digital education platform",
        "categories": ["social", "branding", "uiux"],
        "services_ar": ["سوشيال ميديا", "تصميم باقات", "موك أب واجهات"],
        "services_en": ["Social media", "Package design", "UI mockups"],
        "year": "2026",
        "accent": "#7C6BFF",
        "desc_ar": "حملة إطلاق كاملة لنظام باقات الاشتراك في منصة بساط التعليمية. صُممت 14 قطعة بصرية متناسقة تغطي باقات التأسيس والتدريب والمتكاملة والمؤسسات، مع تركيب ثلاثي الأبعاد وموك أب للوحة التحكم.",
        "desc_en": "A complete launch campaign for the subscription package system of the Besat learning platform. 14 matching visuals covering the foundation, training, integrated and institutions packages, plus 3D compositions and a dashboard mockup.",
        "cover": "01-launch-4-packages",
    },
    {
        "slug": "wejhati",
        "title_ar": "وجهتي | حملة إطلاق تطبيق الحجز",
        "title_en": "Wejhati | Booking app launch campaign",
        "client_ar": "وجهتي",
        "client_en": "Wejhati",
        "kicker_ar": "تطبيق حجز رحلات",
        "kicker_en": "Travel booking app",
        "categories": ["social", "ads"],
        "services_ar": ["حملات إعلانية", "سوشيال ميديا", "تصوير منتجات"],
        "services_en": ["Ad campaigns", "Social media", "Product visuals"],
        "year": "2026",
        "accent": "#B4E01F",
        "desc_ar": "حملة إطلاق لتطبيق وجهتي لحجز الرحلات. هوية بصرية بلون أخضر جريء، تعتمد على مشاهد واقعية للشخصية داخل مطار وخلفية Portland، مع رسائل واضحة تشرح سهولة الحجز.",
        "desc_en": "Launch campaign for the Wejhati travel booking app. A bold green visual identity built on realistic lifestyle scenes set inside an airport, with clear messaging around effortless booking.",
        "cover": "01-app-launch",
    },
    {
        "slug": "rox-ab",
        "title_ar": "ROX × AB Studios | حملة إعلانات فاخرة",
        "title_en": "ROX × AB Studios | Luxury ad campaign",
        "client_ar": "ROX × AB Studios",
        "client_en": "ROX × AB Studios",
        "kicker_ar": "وكالات وعلامات سيارات",
        "kicker_en": "Automotive brands & agencies",
        "categories": ["ads", "branding"],
        "services_ar": ["حملات إعلانية", "تصوير إبداعي", "Retouching"],
        "services_en": ["Ad campaigns", "Creative photography", "Retouching"],
        "year": "2026",
        "accent": "#C9CDD6",
        "desc_ar": "سلسلة إعلانات فاخرة بالأبيض والأسود لسيارات ROX بالشراكة مع AB Studios. معالجات صور دقيقة، إضاءة استوديو عالية التباين، وسرد بصري يحوّل الرؤية إلى تجربة.",
        "desc_en": "A luxury black-and-white ad series for ROX cars with AB Studios. Precision retouching, high-contrast studio lighting and a visual narrative that turns vision into experience.",
        "cover": "01-rox-launch",
    },
    {
        "slug": "caspian",
        "title_ar": "كاسبيان | حملة المطعم",
        "title_en": "Caspian | Restaurant campaign",
        "client_ar": "مطعم كاسبيان",
        "client_en": "Caspian Restaurant",
        "kicker_ar": "مطاعم وأطعمة",
        "kicker_en": "Restaurants & food",
        "categories": ["social", "ads"],
        "services_ar": ["سوشيال ميديا", "حملات إعلانية", "تصوير منتجات"],
        "services_en": ["Social media", "Ad campaigns", "Food photography"],
        "year": "2026",
        "accent": "#FF3B30",
        "desc_ar": "10 منشورات لحملة مطعم كاسبيان بهوية حمراء جريئة. مشاهد طعام واقعية، عروض تفاعلية، وكتابة قصيرة تشد الانتباه — كل قطعة مصممة لتتحول لطلب.",
        "desc_en": "10 posts for the Caspian restaurant campaign with a bold red identity. Realistic food scenes, interactive offers and short copy built to convert into orders.",
        "cover": "01-food-no-alternative",
    },
    {
        "slug": "lixora",
        "title_ar": "لوكورا | حملة العناية بالبشرة",
        "title_en": "Lixora | Skincare campaign",
        "client_ar": "لوكورا",
        "client_en": "Lixora",
        "kicker_ar": "عناية بالبشرة والتجميل",
        "kicker_en": "Skincare & beauty",
        "categories": ["social", "branding"],
        "services_ar": ["سوشيال ميديا", "تصوير منتجات", "عروض"],
        "services_en": ["Social media", "Product photography", "Offers"],
        "year": "2026",
        "accent": "#F26522",
        "desc_ar": "حملة متكاملة لعلامة لوكورا للعناية بالبشرة: تشكيلة منتجات، لقطات تفاصيل، عروض هدايا وحملات موسمية، مع نظام تصميم ثابت يغطي كل نقاط التواصل.",
        "desc_en": "A full campaign for the Lixora skincare brand: product lineups, detail shots, gift offers and seasonal pushes, all held together by one consistent design system across every touchpoint.",
        "cover": "01-social-media-pack",
    },
]


def convert(src_path, dst_path, max_dim, quality):
    im = Image.open(src_path).convert("RGB")
    w, h = im.size
    if max(w, h) > max_dim:
        if w >= h:
            nw, nh = max_dim, int(round(h * max_dim / w))
        else:
            nh, nw = max_dim, int(round(w * max_dim / h))
        im = im.resize((nw, nh), Image.LANCZOS)
    im.save(dst_path, "WEBP", quality=quality, method=6)
    return im.size


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(os.path.dirname(DATA), exist_ok=True)

    by_slug = {p["slug"]: p for p in PROJECTS}
    for p in PROJECTS:
        os.makedirs(os.path.join(OUT, p["slug"]), exist_ok=True)

    for slug, entries in SOURCES.items():
        images = []
        project = by_slug[slug]
        for name, src, alt_ar, alt_en in entries:
            src_path = os.path.join(ROOT, src)
            if not os.path.exists(src_path):
                raise SystemExit("missing source: " + src_path)
            folder = os.path.join(OUT, slug)
            full = os.path.join(folder, name + ".webp")
            large = os.path.join(folder, name + "-l.webp")
            med = os.path.join(folder, name + "-m.webp")
            w, h = convert(src_path, full, MAX_FULL, QUALITY_FULL)
            lw, lh = convert(src_path, large, MAX_LARGE, QUALITY_FULL)
            mw, mh = convert(src_path, med, MAX_MED, QUALITY_MED)
            entry = {
                "file": name + ".webp",
                "file_l": name + "-l.webp",
                "file_m": name + "-m.webp",
                "w": w,
                "h": h,
                "wl": lw,
                "hl": lh,
                "wm": mw,
                "hm": mh,
                "alt_ar": alt_ar,
                "alt_en": alt_en,
            }
            # only the project cover needs a small grid thumbnail
            if name == project["cover"]:
                cover = os.path.join(folder, name + "-c.webp")
                cw, ch = convert(src_path, cover, MAX_COVER, QUALITY_COVER)
                entry["cover"] = name + "-c.webp"
                entry["cover_m"] = name + "-m.webp"
                entry["cover_w"] = cw
                entry["cover_h"] = ch
            images.append(entry)
        project["images"] = images
        project["count"] = len(images)

    data = {
        "site": {
            "domain": "https://haaadymagdy.com",
            "name_ar": "هادي مجدي",
            "name_en": "Haaady Magdy",
        },
        "categories": [
            {"id": "social", "ar": "سوشيال ميديا", "en": "Social Media"},
            {"id": "ads", "ar": "حملات إعلانية", "en": "Ad Campaigns"},
            {"id": "branding", "ar": "براندنج", "en": "Branding"},
            {"id": "uiux", "ar": "واجهات وموك أب", "en": "UI & Mockups"},
        ],
        "projects": PROJECTS,
    }

    with open(DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    total = sum(p["count"] for p in PROJECTS)
    print("projects: %d | images: %d" % (len(PROJECTS), total))
    for p in PROJECTS:
        print("  %-9s %2d images" % (p["slug"], p["count"]))
    print("wrote " + os.path.relpath(DATA, ROOT))


if __name__ == "__main__":
    main()
