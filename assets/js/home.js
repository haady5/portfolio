/* ==========================================================================
   Home page - filter behaviour for the project grid.

   The cards themselves are rendered into index.html at build time (see
   build.py) so the browser finds the cover images immediately - that is a
   huge LCP win on slow connections and it gives search engines the links
   even without JavaScript. This file only handles the filters and swaps the
   card text when the visitor switches language.
   ========================================================================== */
(function () {
  "use strict";

  const data = window.HAAADY_PROJECTS;
  const grid = document.getElementById("projectGrid");
  const filtersBox = document.getElementById("filters");
  if (!data || !grid) return;

  const ARROW = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>';
  const STACK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="12" height="12" rx="2"/><path d="M9 21h10a2 2 0 002-2V9"/></svg>';
  const CARD_SIZES = "(max-width:679px) 100vw, (max-width:1059px) 50vw, 33vw";

  function lang() { return window.Haaady ? window.Haaady.getLang() : "ar"; }
  function pick(ar, en) { return lang() === "en" ? en : ar; }

  const catById = {};
  data.categories.forEach(function (c) { catById[c.id] = c; });

  function coverOf(p) {
    for (var i = 0; i < p.images.length; i++) {
      if (p.images[i].cover) return p.images[i];
    }
    return p.images[0];
  }

  function cardMarkup(p, index) {
    const cover = coverOf(p);
    const title = pick(p.title_ar, p.title_en);
    const kicker = pick(p.kicker_ar, p.kicker_en);
    const desc = pick(p.desc_ar, p.desc_en);
    const countLabel = pick(p.count + " تصميم", p.count + " designs");

    var cats = "";
    p.categories.forEach(function (id) {
      var c = catById[id];
      if (c) cats += '<span class="proj-cat">' + pick(c.ar, c.en) + "</span>";
    });

    const src = "images/projects/" + p.slug + "/" + cover.cover;
    const srcM = "images/projects/" + p.slug + "/" + cover.cover_m;
    const srcset = srcM + " " + cover.wm + "w, " + src + " " + cover.cover_w + "w";

    return (
      '<a class="proj-card" href="projects/' + p.slug + '.html" style="--p-accent:' + p.accent + '"' +
      ' data-cats="' + p.categories.join(" ") + '"' +
      (index === 0 ? ' data-featured="1"' : "") + ">" +
        '<div class="proj-media">' +
          '<img src="' + srcM + '" srcset="' + srcset + '" sizes="' + CARD_SIZES + '"' +
          ' alt="' + title + '" loading="lazy" decoding="async" width="' + cover.wm + '" height="' + cover.hm + '">' +
          '<span class="proj-badge">' + STACK + countLabel + "</span>" +
          '<span class="proj-arrow">' + ARROW + "</span>" +
        "</div>" +
        '<div class="proj-body">' +
          '<span class="proj-kicker">' + kicker + "</span>" +
          '<h3 class="proj-title">' + title + "</h3>" +
          '<p class="proj-desc">' + desc + "</p>" +
          '<div class="proj-foot">' +
            '<div class="proj-cats">' + cats + "</div>" +
            '<span class="proj-count">' + p.year + "</span>" +
          "</div>" +
        "</div>" +
      "</a>"
    );
  }

  function renderGrid() {
    grid.innerHTML = data.projects.map(cardMarkup).join("");
  }

  function applyFilter(filter) {
    var shown = 0;
    grid.querySelectorAll(".proj-card").forEach(function (card) {
      var cats = (card.getAttribute("data-cats") || "").split(" ");
      var match = filter === "all" || cats.indexOf(filter) !== -1;
      card.hidden = !match;
      if (match) shown++;
    });
    var empty = grid.querySelector(".proj-empty");
    if (shown === 0) {
      if (!empty) {
        empty = document.createElement("div");
        empty.className = "proj-empty";
        grid.appendChild(empty);
      }
      empty.textContent = window.Haaady.t("proj_none");
      empty.hidden = false;
    } else if (empty) {
      empty.hidden = true;
    }
  }

  if (filtersBox) {
    filtersBox.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-btn");
      if (!btn) return;
      filtersBox.querySelectorAll(".filter-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      applyFilter(btn.getAttribute("data-filter"));
    });
  }

  /* the static HTML is Arabic - rebuild it if the visitor prefers English */
  if (lang() !== "ar") renderGrid();

  let firstLangEvent = true;
  document.addEventListener("haaady:lang", function () {
    var active = filtersBox && filtersBox.querySelector(".filter-btn.active");
    var current = active ? active.getAttribute("data-filter") : "all";
    if (firstLangEvent) {
      firstLangEvent = false;
      /* the markup that shipped is already Arabic - nothing to rebuild */
      if (lang() === "ar") return;
    }
    renderGrid();
    applyFilter(current);
  });
})();
