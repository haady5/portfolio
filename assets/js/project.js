/* ==========================================================================
   Project detail page — bilingual content + gallery lightbox
   ========================================================================== */
(function () {
  "use strict";

  const data = window.HAAADY_PROJECTS;
  const slug = document.body.getAttribute("data-project");
  if (!data || !slug) return;

  const project = data.projects.filter(function (p) { return p.slug === slug; })[0];
  if (!project) return;

  function lang() { return window.Haaady ? window.Haaady.getLang() : "ar"; }
  function pick(ar, en) { return lang() === "en" ? en : ar; }

  /* ---------- bilingual content ---------- */
  function applyContent() {
    const t = window.Haaady.t;

    const set = function (name, value) {
      document.querySelectorAll('[data-p="' + name + '"]').forEach(function (el) {
        el.textContent = value;
      });
    };

    set("kicker", pick(project.kicker_ar, project.kicker_en));
    set("title", pick(project.title_ar, project.title_en));
    set("desc", pick(project.desc_ar, project.desc_en));
    set("client", pick(project.client_ar, project.client_en));
    set("count", String(project.count));

    const services = pick(project.services_ar, project.services_en) || [];
    document.querySelectorAll('[data-p="services"]').forEach(function (box) {
      box.innerHTML = services.map(function (s) {
        return '<span class="pp-service">' + s + "</span>";
      }).join("");
    });

    /* gallery captions follow the language */
    document.querySelectorAll(".pp-tile").forEach(function (tile, i) {
      const img = project.images[i];
      if (!img) return;
      const alt = pick(img.alt_ar, img.alt_en);
      tile.setAttribute("data-alt", alt);
      tile.setAttribute("aria-label", alt);
      const cap = tile.querySelector(".pp-tile-cap");
      if (cap) cap.textContent = alt;
      const el = tile.querySelector("img");
      if (el) el.alt = alt;
    });

    /* prev / next project */
    const idx = data.projects.indexOf(project);
    const prev = data.projects[(idx - 1 + data.projects.length) % data.projects.length];
    const next = data.projects[(idx + 1) % data.projects.length];

    const prevEl = document.querySelector(".pp-nav-prev");
    const nextEl = document.querySelector(".pp-nav-next");
    if (prevEl) {
      prevEl.querySelector(".pp-nav-card-title").textContent = pick(prev.title_ar, prev.title_en);
      prevEl.querySelector(".pp-nav-card-meta").textContent =
        pick(prev.client_ar, prev.client_en) + " · " + prev.count + " " + t("proj_designs");
    }
    if (nextEl) {
      nextEl.querySelector(".pp-nav-card-title").textContent = pick(next.title_ar, next.title_en);
      nextEl.querySelector(".pp-nav-card-meta").textContent =
        pick(next.client_ar, next.client_en) + " · " + next.count + " " + t("proj_designs");
    }
  }

  /* ---------- masonry gallery ---------- */
  const galleryEl = document.getElementById("ppGallery");
  let masonryTimer = null;

  function layoutMasonry() {
    if (!galleryEl) return;
    const styles = getComputedStyle(galleryEl);
    const rowGap = parseFloat(styles.rowGap) || 0;
    const rowHeight = parseFloat(styles.gridAutoRows) || 4;
    galleryEl.querySelectorAll(".pp-tile").forEach(function (tile) {
      /* offsetHeight ignores the GSAP scale transform - layout height is what matters */
      const h = tile.offsetHeight;
      if (!h) return;
      const span = Math.max(1, Math.round((h + rowGap) / (rowHeight + rowGap)));
      tile.style.gridRowEnd = "span " + span;
    });
  }

  function scheduleMasonry() {
    if (masonryTimer) clearTimeout(masonryTimer);
    masonryTimer = setTimeout(layoutMasonry, 80);
  }

  if (galleryEl) {
    layoutMasonry();
    galleryEl.querySelectorAll("img").forEach(function (img) {
      if (img.complete) return;
      img.addEventListener("load", scheduleMasonry);
      img.addEventListener("error", scheduleMasonry);
    });
    window.addEventListener("resize", scheduleMasonry);
    window.addEventListener("orientationchange", scheduleMasonry);
    if ("ResizeObserver" in window) {
      new ResizeObserver(scheduleMasonry).observe(galleryEl);
    }
    document.addEventListener("haaady:lang", scheduleMasonry);
  }

  /* ---------- lightbox ---------- */
  const gallery = galleryEl;
  const lbx = document.getElementById("lbx");
  if (gallery && lbx) {
    const lbImg = lbx.querySelector(".lbx-stage img");
    const lbTitle = lbx.querySelector(".lbx-title");
    const lbCount = lbx.querySelector(".lbx-count");
    const lbCap = lbx.querySelector(".lbx-cap");
    let list = [];
    let pos = 0;
    let lastFocused = null;

    function show(i) {
      if (i < 0 || i >= list.length) return;
      pos = i;
      const item = list[i];
      lbImg.src = item.src;
      lbImg.alt = item.alt;
      lbTitle.textContent = item.alt;
      if (lbCap) lbCap.textContent = item.alt;
      lbCount.textContent = (i + 1) + " / " + list.length;
    }

    function open(i) {
      lastFocused = document.activeElement;
      show(i);
      lbx.classList.add("open");
      document.body.style.overflow = "hidden";
      lbx.querySelector(".lbx-close").focus();
    }

    function close() {
      lbx.classList.remove("open");
      document.body.style.overflow = "";
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    function step(dir) {
      if (!list.length) return;
      show((pos + dir + list.length) % list.length);
    }

    function buildList() {
      list = Array.prototype.map.call(gallery.querySelectorAll(".pp-tile"), function (tile) {
        const img = tile.querySelector("img");
        return {
          src: tile.getAttribute("data-src") || (img ? img.getAttribute("src") : ""),
          alt: tile.getAttribute("data-alt") || (img ? img.alt : "")
        };
      });
    }

    function tileIndex(tile) {
      return Array.prototype.indexOf.call(gallery.querySelectorAll(".pp-tile"), tile);
    }

    gallery.addEventListener("click", function (e) {
      const tile = e.target.closest(".pp-tile");
      if (!tile) return;
      const idx = tileIndex(tile);
      buildList();
      open(idx);
    });
    /* <button> handles Enter / Space natively - no keydown handler needed */

    lbx.querySelector(".lbx-close").addEventListener("click", close);
    lbx.querySelector(".lbx-prev").addEventListener("click", function () {
      step(window.Haaady.getLang() === "ar" ? 1 : -1);
    });
    lbx.querySelector(".lbx-next").addEventListener("click", function () {
      step(window.Haaady.getLang() === "ar" ? -1 : 1);
    });
    lbx.addEventListener("click", function (e) {
      if (e.target === lbx || e.target.classList.contains("lbx-stage")) close();
    });

    /* keep an open lightbox in sync when the visitor switches language
       (the timeout lets applyContent() refresh the alt text first) */
    document.addEventListener("haaady:lang", function () {
      setTimeout(function () {
        buildList();
        show(pos);
      }, 0);
    });

    document.addEventListener("keydown", function (e) {
      if (!lbx.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") step(window.Haaady.getLang() === "ar" ? 1 : -1);
      if (e.key === "ArrowRight") step(window.Haaady.getLang() === "ar" ? -1 : 1);
    });

    /* swipe on touch devices */
    let startX = 0;
    let startY = 0;
    lbx.addEventListener("touchstart", function (e) {
      startX = e.changedTouches[0].clientX;
      startY = e.changedTouches[0].clientY;
    }, { passive: true });
    lbx.addEventListener("touchend", function (e) {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
        step((dx < 0 ? 1 : -1) * (window.Haaady.getLang() === "ar" ? -1 : 1));
      }
    }, { passive: true });
  }

  applyContent();
  let firstLangEvent = true;
  document.addEventListener("haaady:lang", function () {
    if (firstLangEvent) {
      firstLangEvent = false;
      /* the markup that shipped is already Arabic - nothing to rebuild */
      if (lang() === "ar") return;
    }
    applyContent();
  });
})();
