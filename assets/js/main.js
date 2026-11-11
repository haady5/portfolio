/* ==========================================================================
   Haaady Magdy — shared behaviour
   Theme (dark default) · language · navbar · scrollspy · reveal · counters
   · WhatsApp brief form
   Exposes: window.Haaady = { t, applyLanguage, applyTheme, getLang, getTheme }
   ========================================================================== */
(function () {
  "use strict";

  const dict = window.HAAADY_I18N;
  const root = document.documentElement;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- state ---------- */
  function stored(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  let currentLang = stored("haaady_lang") || "ar";
  /* DARK IS THE DEFAULT - the visitor's OS preference is ignored unless
     they explicitly choose otherwise. */
  let currentTheme = stored("haaady_theme") || "dark";
  let firstApply = true;

  /* ---------- language ---------- */
  function t(key) {
    const table = dict[currentLang] || dict.ar;
    return table[key] !== undefined ? table[key] : (dict.ar[key] || key);
  }

  function applyLanguage(lang) {
    currentLang = lang;
    const table = dict[lang] || dict.ar;
    const dir = lang === "ar" ? "rtl" : "ltr";

    /* Writing lang/dir on <html> invalidates the styles of the whole
       document. The inline head script already set them correctly before
       the first paint, so on the first run there is nothing to change -
       and for Arabic the markup is already Arabic, so the whole DOM
       update can be skipped. Both details save ~1s of main thread work
       on a mid-range phone. */
    const langChanged = root.getAttribute("lang") !== lang;
    const dirChanged = root.getAttribute("dir") !== dir;
    if (langChanged) root.setAttribute("lang", lang);
    if (dirChanged) root.setAttribute("dir", dir);

    const needsTextUpdate = !(firstApply && lang === "ar");
    if (needsTextUpdate) {
      document.querySelectorAll("[data-i18n]").forEach(function (el) {
        const key = el.getAttribute("data-i18n");
        if (table[key] !== undefined) el.textContent = table[key];
      });
      document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
        const key = el.getAttribute("data-i18n-html");
        if (table[key] !== undefined) el.innerHTML = table[key];
      });
    }

    const heroImg = document.querySelector(".hero-portrait");
    if (heroImg) heroImg.alt = table.hero_alt;
    const aboutImg = document.querySelector(".about-img-wrap img");
    if (aboutImg) aboutImg.alt = table.about_alt;

    ["langToggle", "langToggle2"].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = lang === "ar" ? "EN" : "AR";
      /* the accessible name must contain the visible text (EN / AR) */
      el.setAttribute("aria-label",
        lang === "ar" ? "EN - Switch to English" : "AR - التبديل إلى العربية");
    });
    const navCta = document.getElementById("navCta");
    if (navCta) navCta.style.display = "";

    document.title = document.body.getAttribute("data-title-" + lang) ||
      document.title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      const desc = document.body.getAttribute("data-desc-" + lang);
      if (desc) metaDesc.setAttribute("content", desc);
    }

    store("haaady_lang", lang);
    firstApply = false;
    document.dispatchEvent(new CustomEvent("haaady:lang", { detail: { lang: lang } }));
  }

  /* ---------- theme ---------- */
  function applyTheme(theme) {
    currentTheme = theme;
    root.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#06080F" : "#1B4DFF");
    store("haaady_theme", theme);
    /* the hero portrait follows the theme (dark hero / light hero) */
    const hero = document.getElementById("heroImg");
    if (hero && hero.getAttribute("data-active-set") !== theme) {
      hero.src = hero.getAttribute("data-" + theme + "-src");
      hero.srcset = hero.getAttribute("data-" + theme + "-srcset");
      hero.setAttribute("data-active-set", theme);
    }
    document.dispatchEvent(new CustomEvent("haaady:theme", { detail: { theme: theme } }));
  }

  window.Haaady = {
    t: t,
    applyLanguage: applyLanguage,
    applyTheme: applyTheme,
    getLang: function () { return currentLang; },
    getTheme: function () { return currentTheme; },
    prefersReduced: prefersReduced
  };

  ["langToggle", "langToggle2"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", function () {
      applyLanguage(currentLang === "ar" ? "en" : "ar");
    });
  });
  ["themeToggle", "themeToggle2"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", function () {
      applyTheme(currentTheme === "dark" ? "light" : "dark");
    });
  });

  applyLanguage(currentLang);
  applyTheme(currentTheme);

  /* ---------- navbar scroll state ---------- */
  const navbar = document.getElementById("navbar");
  function onScroll() {
    if (!navbar) return;
    if (window.scrollY > 24) navbar.classList.add("scrolled");
    else navbar.classList.remove("scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- active nav link ---------- */
  const sections = ["hero", "work", "services", "about", "contact"]
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);
  const navLinks = document.querySelectorAll(".nav-links a");
  function onScrollSpy() {
    if (!sections.length) return;
    let current = sections[0].id;
    sections.forEach(function (sec) {
      if (window.scrollY + 140 >= sec.offsetTop) current = sec.id;
    });
    navLinks.forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#" + current);
    });
  }
  window.addEventListener("scroll", onScrollSpy, { passive: true });
  onScrollSpy();

  /* ---------- mobile menu ---------- */
  const mobileMenu = document.getElementById("mobileMenu");
  const burgerBtn = document.getElementById("burgerBtn");
  const mobileCloseBtn = document.getElementById("mobileCloseBtn");
  function openMobileMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.add("open");
    if (burgerBtn) burgerBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }
  function closeMobileMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.remove("open");
    if (burgerBtn) burgerBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }
  if (burgerBtn) burgerBtn.addEventListener("click", openMobileMenu);
  if (mobileCloseBtn) mobileCloseBtn.addEventListener("click", closeMobileMenu);
  document.querySelectorAll(".mobile-link, .mobile-menu-foot a").forEach(function (a) {
    a.addEventListener("click", closeMobileMenu);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && mobileMenu && mobileMenu.classList.contains("open")) {
      closeMobileMenu();
      if (burgerBtn) burgerBtn.focus();
    }
  });

  /* ---------- scroll reveal ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  function revealAll() {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }
  /* if anything blows up later, the page must never stay blank */
  window.addEventListener("error", revealAll);
  if (prefersReduced) {
    revealAll();
  } else if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealAll();
  }

  /* ---------- count up ---------- */
  const countEls = document.querySelectorAll(".count-up");
  function animateCount(el) {
    const target = parseInt(el.getAttribute("data-count"), 10) || 0;
    if (prefersReduced) { el.textContent = target; return; }
    const duration = 1400;
    const start = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(eased * target);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if ("IntersectionObserver" in window) {
    const countIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          countIo.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    countEls.forEach(function (el) { countIo.observe(el); });
  } else {
    countEls.forEach(animateCount);
  }

  /* ---------- footer year ---------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- WhatsApp brief form ---------- */
  const form = document.getElementById("briefForm");
  if (form) {
    const steps = form.querySelectorAll(".form-step");
    const stepDots = document.querySelectorAll(".form-steps i");
    const submitBtn = form.querySelector('button[type="submit"]');
    let selectedService = null;

    function goToStep(stepId) {
      steps.forEach(function (s) {
        s.classList.toggle("active", s.getAttribute("data-step") === String(stepId));
      });
      stepDots.forEach(function (dot) {
        const dStep = parseInt(dot.getAttribute("data-step"), 10);
        dot.classList.remove("current", "done");
        if (typeof stepId === "number") {
          if (dStep < stepId) dot.classList.add("done");
          else if (dStep === stepId) dot.classList.add("current");
        }
      });
    }

    function setFieldError(id, show) {
      const el = document.getElementById(id);
      if (el) el.hidden = !show;
    }

    function validateStep1() {
      const ok = !!selectedService;
      setFieldError("serviceError", !ok);
      return ok;
    }
    function validateStep2() {
      const input = form.querySelector('[name="projectName"]');
      const ok = input.value.trim() !== "";
      input.closest(".field").classList.toggle("invalid", !ok);
      setFieldError("projectNameError", !ok);
      if (!ok) input.focus();
      return ok;
    }
    function validateStep3() {
      const email = form.querySelector('[name="email"]');
      const message = form.querySelector('[name="message"]');
      const emailOk = !!email.value && email.checkValidity();
      const messageOk = message.value.trim() !== "";
      email.closest(".field").classList.toggle("invalid", !emailOk);
      setFieldError("emailError", !emailOk);
      message.closest(".field").classList.toggle("invalid", !messageOk);
      setFieldError("messageError", !messageOk);
      if (!emailOk) { email.focus(); return false; }
      if (!messageOk) { message.focus(); return false; }
      return true;
    }

    form.querySelectorAll("[data-next]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const step = btn.closest(".form-step").getAttribute("data-step");
        if (step === "1" && !validateStep1()) return;
        if (step === "2" && !validateStep2()) return;
        goToStep(parseInt(btn.getAttribute("data-next"), 10));
      });
    });
    form.querySelectorAll("[data-prev]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        goToStep(parseInt(btn.getAttribute("data-prev"), 10));
      });
    });

    const serviceOptions = form.querySelectorAll("#serviceOptions .option-card");
    serviceOptions.forEach(function (opt) {
      opt.addEventListener("click", function () {
        serviceOptions.forEach(function (o) {
          o.classList.remove("selected");
          o.setAttribute("aria-pressed", "false");
        });
        opt.classList.add("selected");
        opt.setAttribute("aria-pressed", "true");
        selectedService = opt.getAttribute("data-value");
        setFieldError("serviceError", false);
      });
    });

    const WA_NUMBER = "201140634814";
    const serviceLabels = {
      ar: { branding: "Branding", logo: "شعار", social: "سوشيال ميديا", ads: "إعلانات", print: "مطبوعات", uiux: "UI/UX" },
      en: { branding: "Branding", logo: "Logo", social: "Social Media", ads: "Advertising", print: "Printing", uiux: "UI/UX" }
    };

    function buildWhatsAppMessage(data) {
      const lang = currentLang;
      const labels = serviceLabels[lang] || serviceLabels.ar;
      const timeline = {
        asap: lang === "ar" ? "أسرع وقت ممكن" : "As soon as possible",
        "2d-1w": lang === "ar" ? "من يومين لأسبوع" : "2 days to 1 week",
        flex: lang === "ar" ? "مرن، مفيش استعجال" : "Flexible, no rush"
      };
      const head = lang === "ar" ? "طلب مشروع جديد" : "New project request";
      const lines = lang === "ar"
        ? [
            "*طلب مشروع جديد*",
            "الخدمة: " + (labels[data.service] || data.service),
            "اسم المشروع / العلامة: " + data.projectName,
            "الموعد المطلوب: " + (timeline[data.timeline] || data.timeline || "—"),
            "البريد الإلكتروني: " + data.email,
            "رقم الواتساب: " + (data.whatsapp || "—"),
            "",
            "تفاصيل المشروع:",
            data.message
          ]
        : [
            "*New project request*",
            "Service: " + (labels[data.service] || data.service),
            "Project / brand: " + data.projectName,
            "Timeline: " + (timeline[data.timeline] || data.timeline || "—"),
            "Email: " + data.email,
            "WhatsApp: " + (data.whatsapp || "—"),
            "",
            "Project details:",
            data.message
          ];
      return lines.join("\n");
    }

    function resetBriefForm() {
      form.reset();
      selectedService = null;
      serviceOptions.forEach(function (o) {
        o.classList.remove("selected");
        o.setAttribute("aria-pressed", "false");
      });
      form.querySelectorAll(".field").forEach(function (f) { f.classList.remove("invalid"); });
      ["serviceError", "projectNameError", "emailError", "messageError"].forEach(function (id) {
        setFieldError(id, false);
      });
      goToStep(1);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validateStep3()) return;
      const formData = {
        service: selectedService,
        projectName: form.querySelector('[name="projectName"]').value.trim(),
        email: form.querySelector('[name="email"]').value.trim(),
        whatsapp: form.querySelector('[name="whatsapp"]').value.trim(),
        message: form.querySelector('[name="message"]').value.trim()
      };
      const waUrl = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(buildWhatsAppMessage(formData));
      window.open(waUrl, "_blank", "noopener");
      goToStep("success");
      resetBriefForm();
    });

    const sendAnotherBtn = document.getElementById("sendAnotherBtn");
    if (sendAnotherBtn) {
      sendAnotherBtn.addEventListener("click", function () { goToStep(1); });
    }
  }

  /* ---------- magnetic buttons + hero tilt (vanilla, mouse only) ---------- */
  (function () {
    if (prefersReduced || !window.matchMedia("(pointer: fine)").matches) return;

    document.querySelectorAll(".btn-primary").forEach(function (btn) {
      const strength = 0.18;
      let raf = null, tx = 0, ty = 0;
      function apply() {
        raf = null;
        btn.style.transform = "translate(" + tx + "px," + ty + "px)";
      }
      btn.addEventListener("mousemove", function (e) {
        const r = btn.getBoundingClientRect();
        tx = (e.clientX - r.left - r.width / 2) * strength;
        ty = (e.clientY - r.top - r.height / 2) * strength;
        if (!raf) raf = requestAnimationFrame(apply);
      });
      btn.addEventListener("mouseleave", function () {
        tx = 0; ty = 0;
        if (!raf) raf = requestAnimationFrame(apply);
      });
    });

    const portrait = document.querySelector(".hero-portrait");
    const visual = document.querySelector(".hero-visual");
    if (portrait && visual) {
      let raf = null;
      visual.addEventListener("mousemove", function (e) {
        const r = visual.getBoundingClientRect();
        const px = (e.clientX - r.left - r.width / 2) / r.width;
        const py = (e.clientY - r.top - r.height / 2) / r.height;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          portrait.style.transform =
            "perspective(800px) rotateY(" + px * 7 + "deg) rotateX(" + py * -7 + "deg)";
        });
      });
      visual.addEventListener("mouseleave", function () {
        if (raf) cancelAnimationFrame(raf);
        portrait.style.transform = "perspective(800px) rotateY(0deg) rotateX(0deg)";
      });
    }
  })();
})();
