/* =========================================================================
   Sharemics — Frontend
   Ohne Framework, ohne Abhängigkeiten. Alles ist progressiv: Ohne JavaScript
   bleiben Navigation, Inhalte und Formular-Fallbacks nutzbar.
   ========================================================================= */

(() => {
  "use strict";

  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));

  const MAIL = "hallo@sharemics.de";
  const money = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* privater Modus — dann eben nur für diese Sitzung */
      }
    },
  };

  /* ------------------------------------------------------------- Hinweise */

  const toastEl = $("#toast");
  let toastTimer;
  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 3600);
  }

  /* ----------------------------------------------------- Fokus einsperren */

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function createTrap(container) {
    let lastFocused = null;

    function onKeydown(event) {
      if (event.key !== "Tab") return;
      const items = $$(FOCUSABLE, container).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    return {
      activate() {
        lastFocused = document.activeElement;
        document.addEventListener("keydown", onKeydown);
        const target = $$(FOCUSABLE, container).find((el) => el.offsetParent !== null);
        if (target) target.focus();
      },
      release() {
        document.removeEventListener("keydown", onKeydown);
        if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
      },
    };
  }

  /* ------------------------------------------------------------ 1 Theme */

  const themeToggle = $("#themeToggle");
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    if (themeToggle) themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  }
  applyTheme(document.documentElement.dataset.theme || "light");

  themeToggle?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    // Bewusst roh gespeichert: das Inline-Skript im <head> liest den Wert ohne JSON.parse.
    try {
      localStorage.setItem("sharemics-theme", next);
    } catch {
      /* privater Modus */
    }
    toast(next === "dark" ? "Abendbrand — dunkle Ansicht." : "Sonnenaufgang — helle Ansicht.");
  });

  /* -------------------------------------------------------- 2 Navigation */

  const navToggle = $("#navToggle");
  const siteNav = $("#siteNav");

  navToggle?.addEventListener("click", () => {
    const open = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
  });

  document.addEventListener("click", (event) => {
    if (!siteNav?.classList.contains("is-open")) return;
    if (siteNav.contains(event.target) || navToggle.contains(event.target)) return;
    siteNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  });

  const header = $("#siteHeader");
  if (header) {
    const onScroll = () => header.classList.toggle("is-stuck", window.scrollY > 12);
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
  }

  /* ------------------------------------------------------- 3 Warenkorb */

  const CART_KEY = "sharemics-cart";
  let cart = store.get(CART_KEY, []).filter((line) => line && line.id && line.qty > 0);

  const cartDrawer = $("#cartDrawer");
  const cartBody = $("#cartBody");
  const cartButton = $("#cartButton");
  const scrim = $("#scrim");
  const cartTrap = cartDrawer ? createTrap(cartDrawer) : null;

  const vesselCache = new Map();
  function vesselMarkup(name, tone) {
    // Die Illustration steht bereits auf der Seite — einmal klonen genügt.
    if (!vesselCache.has(name)) {
      const source = document.querySelector(`.add-to-cart[data-vessel="${name}"]`);
      const figure = source?.closest(".product-card")?.querySelector(".vessel");
      vesselCache.set(name, figure ? figure.outerHTML : "");
    }
    return `<div class="cart-thumb tone-${tone}">${vesselCache.get(name)}</div>`;
  }

  function cartCount() {
    return cart.reduce((sum, line) => sum + line.qty, 0);
  }

  function cartTotal() {
    return cart.reduce((sum, line) => sum + line.price * line.qty, 0);
  }

  function renderCart() {
    const count = cartCount();
    const countEl = $("#cartCount");
    const labelEl = $("#cartCountLabel");
    if (countEl) countEl.textContent = String(count);
    if (labelEl) {
      labelEl.textContent = count === 1 ? "1 Artikel im Warenkorb" : `${count} Artikel im Warenkorb`;
    }

    if (!cartBody) return;

    if (!cart.length) {
      cartBody.innerHTML = `
        <div class="cart-empty">
          <p>Noch nichts drin.</p>
          <p><a class="button button-ghost button-sm" href="shop.html">Zum Shop</a></p>
        </div>`;
    } else {
      cartBody.innerHTML = cart
        .map(
          (line) => `
        <article class="cart-line" data-id="${line.id}">
          ${vesselMarkup(line.vessel, line.tone)}
          <div>
            <h3>${line.name}</h3>
            <p>${money.format(line.price)} pro Stück</p>
            <div class="qty">
              <button type="button" data-step="-1" aria-label="Weniger ${line.name}">−</button>
              <output aria-label="Menge ${line.name}">${line.qty}</output>
              <button type="button" data-step="1" aria-label="Mehr ${line.name}">+</button>
            </div>
          </div>
          <div>
            <span class="cart-line-price">${money.format(line.price * line.qty)}</span>
            <button class="cart-remove" type="button" data-remove>Entfernen</button>
          </div>
        </article>`
        )
        .join("");
    }

    const totalEl = $("#cartTotal");
    if (totalEl) totalEl.textContent = money.format(cartTotal());
    store.set(CART_KEY, cart);
  }

  function openCart() {
    if (!cartDrawer) return;
    cartDrawer.hidden = false;
    scrim.hidden = false;
    requestAnimationFrame(() => {
      cartDrawer.classList.add("is-open");
      scrim.classList.add("is-open");
    });
    cartDrawer.setAttribute("aria-hidden", "false");
    cartButton?.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    cartTrap?.activate();
  }

  function closeCart() {
    if (!cartDrawer || cartDrawer.hidden) return;
    cartDrawer.classList.remove("is-open");
    scrim.classList.remove("is-open");
    cartDrawer.setAttribute("aria-hidden", "true");
    cartButton?.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    cartTrap?.release();
    setTimeout(() => {
      cartDrawer.hidden = true;
      scrim.hidden = true;
    }, 320);
  }

  cartButton?.addEventListener("click", openCart);
  $("#cartClose")?.addEventListener("click", closeCart);
  scrim?.addEventListener("click", closeCart);

  document.addEventListener("click", (event) => {
    const add = event.target.closest(".add-to-cart");
    if (!add) return;
    const { id, name, price, vessel, tone } = add.dataset;
    const line = cart.find((item) => item.id === id);
    if (line) line.qty += 1;
    else cart.push({ id, name, price: Number(price), vessel, tone, qty: 1 });
    renderCart();
    cartButton?.classList.add("is-bumped");
    setTimeout(() => cartButton?.classList.remove("is-bumped"), 420);
    toast(`${name} liegt im Korb.`);
  });

  cartBody?.addEventListener("click", (event) => {
    const row = event.target.closest(".cart-line");
    if (!row) return;
    const line = cart.find((item) => item.id === row.dataset.id);
    if (!line) return;

    if (event.target.closest("[data-remove]")) {
      cart = cart.filter((item) => item.id !== line.id);
      toast(`${line.name} entfernt.`);
    } else {
      const step = event.target.closest("[data-step]");
      if (!step) return;
      line.qty += Number(step.dataset.step);
      if (line.qty < 1) cart = cart.filter((item) => item.id !== line.id);
    }
    renderCart();
  });

  $("#checkout")?.addEventListener("click", () => {
    if (!cart.length) {
      toast("Der Korb ist noch leer.");
      return;
    }
    const lines = cart
      .map((line) => `${line.qty} × ${line.name} (${money.format(line.price * line.qty)})`)
      .join("\n");
    const body = [
      "Hallo Sharemics,",
      "",
      "ich möchte gern bestellen:",
      "",
      lines,
      "",
      `Summe: ${money.format(cartTotal())}`,
      "",
      "Lieferadresse oder Abholung:",
      "",
    ].join("\n");
    location.href = `mailto:${MAIL}?subject=${encodeURIComponent("Bestellung über sharemics.de")}&body=${encodeURIComponent(body)}`;
    toast("Wir öffnen eine vorbereitete E-Mail mit deiner Bestellung.");
  });

  renderCart();

  /* ---------------------------------------------------------- 4 Shop */

  const productGrid = $("#productGrid");
  if (productGrid) {
    const cards = $$(".product-card", productGrid);
    const emptyNote = $("#shopEmpty");
    let activeFilter = "all";

    function applyShop() {
      const sort = $("#shopSort")?.value ?? "default";
      const visible = cards.filter((card) => {
        const match = activeFilter === "all" || card.dataset.category === activeFilter;
        card.hidden = !match;
        return match;
      });

      if (sort !== "default") {
        visible
          .slice()
          .sort((a, b) => {
            const pa = Number(a.dataset.price);
            const pb = Number(b.dataset.price);
            if (sort === "price-asc") return pa - pb;
            if (sort === "price-desc") return pb - pa;
            return a.dataset.name.localeCompare(b.dataset.name, "de");
          })
          .forEach((card) => productGrid.appendChild(card));
      }

      if (emptyNote) emptyNote.hidden = visible.length > 0;
      const counter = $("#shopCount");
      if (counter) {
        counter.textContent =
          visible.length === 1 ? "1 Stück" : `${visible.length} Stücke`;
      }
    }

    $$(".filter").forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;
        $$(".filter").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        applyShop();
      });
    });

    $("#shopSort")?.addEventListener("change", applyShop);
    applyShop();
  }

  /* ------------------------------------------------------- 5 Kurskalender */

  const calendarEl = $("#calendarDays");
  const courseDataEl = $("#courseData");

  if (calendarEl && courseDataEl) {
    const data = JSON.parse(courseDataEl.textContent);
    const formats = Object.fromEntries(data.formats.map((f) => [f.id, f]));
    const dates = Object.fromEntries(data.dates.map((d) => [d.date, d]));
    const sorted = data.dates.map((d) => d.date).sort();
    const firstMonth = new Date(`${sorted[0]}T12:00:00`);
    const lastMonth = new Date(`${sorted[sorted.length - 1]}T12:00:00`);

    let view = new Date(firstMonth.getFullYear(), firstMonth.getMonth(), 1);
    let selected = null;

    const monthLabel = $("#calendarMonth");
    const prev = $("#calendarPrev");
    const next = $("#calendarNext");
    const panel = $("#bookingPanel");

    const keyOf = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const inRange = (d) =>
      d.getFullYear() * 12 + d.getMonth() >= firstMonth.getFullYear() * 12 + firstMonth.getMonth() &&
      d.getFullYear() * 12 + d.getMonth() <= lastMonth.getFullYear() * 12 + lastMonth.getMonth();

    function renderPanel() {
      if (!panel) return;
      if (!selected) {
        panel.innerHTML = `
          <div class="slot">
            <p class="eyebrow">Termin wählen</p>
            <h3>Such dir links ein Wochenende aus.</h3>
            <p>Markierte Tage haben noch freie Plätze. Sobald du einen auswählst, stehen hier Kurszeit, Level, Preis und die Zahl der freien Plätze.</p>
          </div>`;
        return;
      }
      const entry = dates[selected];
      const format = formats[entry.format];
      const date = new Date(`${selected}T12:00:00`);
      panel.innerHTML = `
        <article class="slot">
          <div class="slot-head">
            <div>
              <p class="eyebrow">${date.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" })}</p>
              <h3>${format.title}</h3>
            </div>
            <span class="slot-seats">${entry.seats} ${entry.seats === 1 ? "Platz" : "Plätze"} frei</span>
          </div>
          <p>${format.text}</p>
          <p class="pill-row" style="margin-top:.9rem">
            <span class="pill">${format.duration}</span><span class="pill">${format.level}</span>
          </p>
          <div class="slot-foot">
            <p class="slot-price">${money.format(format.price)} <span style="font-size:.8rem">pro Person</span></p>
            <button class="button button-primary" type="button" id="openBooking">Platz anfragen</button>
          </div>
        </article>`;
    }

    function renderCalendar(focusDay) {
      const year = view.getFullYear();
      const month = view.getMonth();
      monthLabel.textContent = view.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
      prev.disabled = !inRange(new Date(year, month - 1, 1));
      next.disabled = !inRange(new Date(year, month + 1, 1));

      const offset = (new Date(year, month, 1).getDay() + 6) % 7;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const daysBefore = new Date(year, month, 0).getDate();
      const cells = [];

      for (let i = offset; i > 0; i -= 1) {
        cells.push(`<div class="day is-outside" aria-hidden="true">${daysBefore - i + 1}</div>`);
      }
      for (let day = 1; day <= daysInMonth; day += 1) {
        const key = keyOf(new Date(year, month, day));
        const entry = dates[key];
        if (!entry) {
          cells.push(`<div class="day">${day}</div>`);
          continue;
        }
        const format = formats[entry.format];
        cells.push(
          `<button class="day" type="button" data-date="${key}" aria-pressed="${key === selected}" ` +
            `aria-label="${day}. ${view.toLocaleDateString("de-DE", { month: "long" })}, ${format.title}, ${entry.seats} Plätze frei">` +
            `<span>${day}</span><small>${entry.seats} frei</small></button>`
        );
      }
      calendarEl.innerHTML = cells.join("");

      if (focusDay) {
        const target = $(`[data-date="${focusDay}"]`, calendarEl);
        if (target) target.focus();
      }
    }

    function selectDate(key) {
      selected = key;
      renderCalendar(key);
      renderPanel();
    }

    calendarEl.addEventListener("click", (event) => {
      const button = event.target.closest("[data-date]");
      if (button) selectDate(button.dataset.date);
    });

    calendarEl.addEventListener("keydown", (event) => {
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(event.key)) return;
      const buttons = $$("[data-date]", calendarEl);
      const index = buttons.indexOf(document.activeElement);
      if (index === -1) return;
      event.preventDefault();
      const target =
        event.key === "Home"
          ? buttons[0]
          : event.key === "End"
            ? buttons[buttons.length - 1]
            : buttons[index + (event.key === "ArrowRight" ? 1 : -1)];
      target?.focus();
    });

    prev.addEventListener("click", () => {
      view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
      renderCalendar();
    });
    next.addEventListener("click", () => {
      view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
      renderCalendar();
    });

    renderCalendar();
    renderPanel();

    /* ------------------------------------------------- 6 Buchungsdialog */

    const dialog = $("#bookingDialog");
    const dialogTrap = dialog ? createTrap(dialog) : null;

    function openBooking() {
      if (!selected) {
        toast("Bitte zuerst einen Termin auswählen.");
        return;
      }
      const entry = dates[selected];
      const format = formats[entry.format];
      const date = new Date(`${selected}T12:00:00`);
      $("#bookingSummary").innerHTML =
        `<strong>${date.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</strong><br>` +
        `${format.title} · ${format.duration} · ${money.format(format.price)} pro Person`;
      dialog.hidden = false;
      requestAnimationFrame(() => dialog.classList.add("is-open"));
      document.body.style.overflow = "hidden";
      dialogTrap.activate();
    }

    function closeBooking() {
      if (!dialog || dialog.hidden) return;
      dialog.classList.remove("is-open");
      document.body.style.overflow = "";
      dialogTrap.release();
      setTimeout(() => {
        dialog.hidden = true;
      }, 280);
    }

    document.addEventListener("click", (event) => {
      if (event.target.closest("#openBooking, [data-open-booking]")) openBooking();
      if (event.target === dialog || event.target.closest("#bookingClose")) closeBooking();
    });

    $("#bookingForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.target;
      if (!validate(form)) return;
      const entry = dates[selected];
      const format = formats[entry.format];
      const date = new Date(`${selected}T12:00:00`);
      const body = [
        "Hallo Sharemics,",
        "",
        `ich möchte gern einen Platz im Kurs „${format.title}“ anfragen.`,
        "",
        `Termin: ${date.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} (${format.duration})`,
        `Personen: ${form.people.value}`,
        `Name: ${form.name.value}`,
        `E-Mail: ${form.email.value}`,
        form.note.value ? `Hinweis: ${form.note.value}` : "",
        "",
      ]
        .filter(Boolean)
        .join("\n");
      location.href = `mailto:${MAIL}?subject=${encodeURIComponent(`Kursanfrage ${format.title}`)}&body=${encodeURIComponent(body)}`;
      closeBooking();
      form.reset();
      toast("Wir öffnen eine vorbereitete E-Mail mit deiner Anfrage.");
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeBooking();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCart();
  });

  /* ------------------------------------------------------- 7 Formulare */

  function validate(form) {
    let valid = true;
    $$("input, textarea, select", form).forEach((field) => {
      const wrapper = field.closest(".field");
      const existing = wrapper?.querySelector(".field-error");
      existing?.remove();
      field.removeAttribute("aria-invalid");
      if (field.checkValidity()) return;
      valid = false;
      field.setAttribute("aria-invalid", "true");
      if (wrapper) {
        const note = document.createElement("span");
        note.className = "field-error";
        note.textContent =
          field.type === "email"
            ? "Bitte eine gültige E-Mail-Adresse angeben."
            : field.type === "checkbox"
              ? "Bitte bestätigen, damit wir antworten dürfen."
              : "Bitte ausfüllen.";
        wrapper.appendChild(note);
      }
    });
    if (!valid) {
      $('[aria-invalid="true"]', form)?.focus();
      toast("Bitte die markierten Felder prüfen.");
    }
    return valid;
  }

  $("#contactForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    if (!validate(form)) return;
    const body = [
      `Name: ${form.name.value}`,
      `E-Mail: ${form.email.value}`,
      `Thema: ${form.topic.value}`,
      "",
      form.message.value,
      "",
    ].join("\n");
    location.href = `mailto:${MAIL}?subject=${encodeURIComponent(`Anfrage: ${form.topic.value}`)}&body=${encodeURIComponent(body)}`;
    toast("Wir öffnen eine vorbereitete E-Mail an die Werkstatt.");
  });

  $$(".newsletter-form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = $("input", form);
      if (!input.checkValidity()) {
        toast("Bitte eine gültige E-Mail-Adresse angeben.");
        input.focus();
        return;
      }
      location.href = `mailto:${MAIL}?subject=${encodeURIComponent("Newsletter abonnieren")}&body=${encodeURIComponent(`Bitte tragt mich in den Newsletter ein: ${input.value}`)}`;
      form.reset();
      toast("Wir öffnen eine vorbereitete E-Mail für die Anmeldung.");
    });
  });

  /* ------------------------------------------------- 8 Einblenden & Rest */

  const reveals = $$(".reveal");
  if (reveals.length && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    reveals.forEach((el) => observer.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-in"));
  }
})();
