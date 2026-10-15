/* Missouri State Fair — single deferred script, no dependencies.
   FAIR_DATA is the one source of truth for dates; the HTML carries the same
   content statically so everything still works with JavaScript disabled. */

const FAIR_DATA = {
  // 2027 run. Gates open daily 7:30 am; times use America/Chicago (CDT, -05:00).
  opens: "2027-08-12T07:30:00-05:00",
  closes: "2027-08-22T22:00:00-05:00",
  firstDay: "2027-08-12",
  lastDay: "2027-08-22",
  tz: "America/Chicago",
};

const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];

document.documentElement.classList.remove("no-js");
document.documentElement.classList.add("js");

/* ---------- Current page in nav ---------- */
const page = document.body.dataset.page;
if (page) {
  $$(".site-nav a[data-nav]").forEach((a) => {
    if (a.dataset.nav === page) a.setAttribute("aria-current", "page");
  });
}

/* ---------- Mobile nav ---------- */
const navToggle = $(".nav-toggle");
const navList = $("#nav-list");
if (navToggle && navList) {
  navToggle.addEventListener("click", () => {
    const open = navList.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navList.classList.contains("open")) {
      navList.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.focus();
    }
  });
}

/* ---------- Countdown ---------- */
const countdown = $("#countdown");
if (countdown) {
  const opens = new Date(FAIR_DATA.opens);
  const closes = new Date(FAIR_DATA.closes);
  const cells = {
    d: $("[data-days]", countdown),
    h: $("[data-hours]", countdown),
    m: $("[data-mins]", countdown),
    s: $("[data-secs]", countdown),
  };
  const done = (msg) => {
    countdown.outerHTML = `<p class="date-lockup"><span class="d">${msg}</span></p>`;
  };
  const tick = () => {
    const now = new Date();
    if (now >= closes) return done("See you next August!");
    if (now >= opens) return done("The gates are open!");
    let diff = Math.floor((opens - now) / 1000);
    const d = Math.floor(diff / 86400);
    diff -= d * 86400;
    const h = Math.floor(diff / 3600);
    diff -= h * 3600;
    const m = Math.floor(diff / 60);
    const s = diff - m * 60;
    cells.d.textContent = d;
    cells.h.textContent = String(h).padStart(2, "0");
    cells.m.textContent = String(m).padStart(2, "0");
    cells.s.textContent = String(s).padStart(2, "0");
    setTimeout(tick, 1000);
  };
  tick();
}

/* ---------- Live status chip ---------- */
const fairToday = new Intl.DateTimeFormat("en-CA", { timeZone: FAIR_DATA.tz }).format(new Date());
const statusChip = $("#fair-status");
if (statusChip && fairToday >= FAIR_DATA.firstDay && fairToday <= FAIR_DATA.lastDay) {
  statusChip.textContent = "Fair is on today";
  statusChip.hidden = false;
}

/* ---------- Highlight "today" on day rail + hours tables ---------- */
$$("[data-date]").forEach((el) => {
  if (el.dataset.date !== fairToday) return;
  el.classList.add("is-today");
  const slot = el.querySelector(".dow");
  if (slot) {
    const marker = document.createElement("span");
    marker.className = "deal";
    marker.textContent = "Today";
    slot.appendChild(marker);
  }
});

/* ---------- Category filters (events, participate) ---------- */
$$(".chip-row").forEach((row) => {
  const scope = $(row.dataset.target) || document;
  const chips = $$(".chip", row);
  chips.forEach((chip) =>
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      const cat = chip.dataset.filter;
      $$("[data-cat]", scope).forEach((item) => {
        item.hidden = cat !== "all" && !item.dataset.cat.split(" ").includes(cat);
      });
    })
  );
});

/* ---------- FAQ live search ---------- */
const faqSearch = $("#faq-search");
if (faqSearch) {
  const items = $$("details.qa");
  const groups = $$(".faq-group");
  const empty = $("#faq-empty");
  faqSearch.addEventListener("input", () => {
    const q = faqSearch.value.trim().toLowerCase();
    let shown = 0;
    items.forEach((d) => {
      const hit = !q || d.textContent.toLowerCase().includes(q);
      d.hidden = !hit;
      if (hit) shown++;
      if (q && hit) d.open = true;
      if (!q) d.open = false;
    });
    groups.forEach((g) => {
      g.hidden = !$$("details.qa", g).some((d) => !d.hidden);
    });
    if (empty) empty.hidden = shown > 0;
  });
}

/* ---------- Add-to-calendar (.ics) ---------- */
$$("[data-ics]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Missouri State Fair concept//EN",
      "BEGIN:VEVENT",
      "UID:msf-2027@mostatefair-concept",
      "DTSTAMP:20261014T000000Z",
      "DTSTART;VALUE=DATE:20270812",
      "DTEND;VALUE=DATE:20270823",
      "SUMMARY:Missouri State Fair 2027",
      "LOCATION:Missouri State Fairgrounds\\, 2503 W. 16th St\\, Sedalia\\, MO 65301",
      "DESCRIPTION:Eleven days of agriculture\\, Grandstand concerts\\, the carnival midway and fair food. Gates open daily at 7:30 am.",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "missouri-state-fair-2027.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
});

/* ---------- Reveal on scroll ---------- */
const revealEls = $$(".reveal");
if ("IntersectionObserver" in window && revealEls.length) {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      }),
    { rootMargin: "0px 0px -8% 0px" }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("in"));
}

/* ---------- Hero video: autoplay unless reduced motion, pause control ---------- */
const heroVideo = $(".hero-video");
if (heroVideo) {
  const hero = heroVideo.closest(".show-hero");
  const toggle = $("#hero-toggle");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const setState = (paused) => {
    hero.classList.toggle("is-paused", paused);
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(paused));
      toggle.querySelector("span").textContent = paused ? "Play video" : "Pause video";
    }
  };
  if (still) {
    setState(true);
  } else {
    heroVideo.play().then(() => setState(false)).catch(() => setState(true));
  }
  if (toggle) {
    toggle.addEventListener("click", () => {
      if (heroVideo.paused) heroVideo.play().then(() => setState(false)).catch(() => {});
      else { heroVideo.pause(); setState(true); }
    });
  }
  // Save battery: pause while the hero is off-screen (unless the visitor paused it).
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => {
      if (hero.classList.contains("is-paused")) return;
      if (e.isIntersecting) heroVideo.play().catch(() => {});
      else heroVideo.pause();
    }).observe(hero);
  }
}

/* ---------- Home: header floats over the hero, turns solid past it ---------- */
const head = $(".site-head");
if (head && document.body.dataset.page === "home") {
  const heroEl = $(".show-hero");
  const setH = () => document.documentElement.style.setProperty("--head-h", head.offsetHeight + "px");
  setH();
  addEventListener("resize", setH);
  const onScroll = () => {
    const limit = heroEl ? heroEl.offsetHeight - head.offsetHeight - 40 : 80;
    head.classList.toggle("is-solid", scrollY > limit || (navList && navList.classList.contains("open")));
  };
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });
  if (navToggle) navToggle.addEventListener("click", onScroll);
}

/* ---------- Count-up numbers (rosettes) ---------- */
const counters = $$("[data-count]");
if (counters.length && "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const fmt = (el, v) => (el.dataset.prefix || "") + Math.round(v).toLocaleString("en-US") + (el.dataset.suffix || "");
  const run = (el) => {
    const target = +el.dataset.count, t0 = performance.now(), dur = 1400;
    const step = (t) => {
      const u = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - u, 3);
      el.textContent = fmt(el, target * e);
      if (u < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const co = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { run(en.target); co.unobserve(en.target); }
  }), { threshold: 0.6 });
  counters.forEach((el) => { el.textContent = fmt(el, 0); co.observe(el); });
}

/* ---------- Footer year ---------- */
$$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

/* ---------- Service worker (offline + installable) ---------- */
if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
