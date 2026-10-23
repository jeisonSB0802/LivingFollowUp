const groupList = document.querySelector("#group-list");
const emptyState = document.querySelector("#empty-state");
const resultsSummary = document.querySelector("#results-summary");
const groupSearch = document.querySelector("#group-search");
const filterSelect = document.querySelector("#filter-select");
const filterSelectWrap = document.querySelector(".filter-select-wrap");
const filterLabel = document.querySelector("#filter-label");
const resetFiltersButton = document.querySelector("#reset-filters");
const emptyResetButton = document.querySelector("#empty-reset");
const generalContact = document.querySelector("#general-contact");
const redirectDialog = document.querySelector("#redirect-dialog");
const redirectClose = document.querySelector("#redirect-close");
const redirectContinue = document.querySelector("#redirect-continue");
const redirectLoader = document.querySelector("#redirect-loader");
const redirectLoading = document.querySelector("#redirect-loading");
const groupsSection = document.querySelector("#grupos");
const exploreGroupsLink = document.querySelector(".hero-cta");
let groups = [];
let filterMode = "all";
let redirectTimeout = null;
let pendingWhatsAppUrl = null;
const groupCardObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.remove("is-revealing");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 })
  : null;

const dayOrder = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const davidHerreraPhone = "50663658363";

exploreGroupsLink.addEventListener("click", () => {
  groupsSection.classList.remove("is-arriving");
  window.requestAnimationFrame(() => groupsSection.classList.add("is-arriving"));
});

function revealGroupCards() {
  if (!groupCardObserver) {
    return;
  }
  groupCardObserver.disconnect();
  groupList.querySelectorAll(".group-card").forEach((card) => {
    card.classList.add("is-revealing");
    groupCardObserver.observe(card);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function normalizeSearch(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

function formatTime(value) {
  const match = value.match(/^(\d{1,2}:\d{2})\s*(am|pm)$/i);
  if (!match) {
    return value;
  }
  const period = match[2].toLowerCase() === "am" ? "a. m." : "p. m.";
  return `${match[1]} ${period}`;
}

function getGroupCard(group) {
  const leaders = group.lideres.map(escapeHtml).join(" · ");
  const leadersLabel = group.lideres.length === 1 ? "Líder" : "Líderes";
  const zoneLabel = `<span class="zone-label">${escapeHtml(group.zona)}</span>`;
  return `
    <article class="group-card">
      <div class="card-topline">
        ${zoneLabel}
      </div>
      <h4>${escapeHtml(group.lugar)}</h4>
      <dl class="group-details">
        <div><dt>${leadersLabel}</dt><dd>${leaders}</dd></div>
        <div><dt>Hora</dt><dd>${escapeHtml(formatTime(group.hora))}</dd></div>
        ${group.referencia ? `<div><dt>Referencia</dt><dd>${escapeHtml(group.referencia)}</dd></div>` : ""}
      </dl>
      <button class="button button-pink join-button" type="button" data-group-id="${escapeHtml(group.id)}">Me interesa unirme <span aria-hidden="true">↗</span></button>
    </article>
  `;
}

function getFilteredGroups() {
  const query = normalizeSearch(groupSearch.value);
  if (filterMode === "day") {
    return filterGroups(groups.filter((group) => group.dia === filterSelect.value), query);
  }
  if (filterMode === "zone") {
    return filterGroups(groups.filter((group) => group.zona === filterSelect.value), query);
  }
  return filterGroups(groups, query);
}

function filterGroups(sourceGroups, query) {
  if (!query) {
    return sourceGroups;
  }
  return sourceGroups.filter((group) => normalizeSearch([
    group.zona,
    group.lugar,
    group.dia,
    ...group.lideres,
  ].join(" ")).includes(query));
}

function renderGroups() {
  const visibleGroups = getFilteredGroups();
  const groupsByDay = new Map();
  visibleGroups.forEach((group) => {
    if (!groupsByDay.has(group.dia)) {
      groupsByDay.set(group.dia, []);
    }
    groupsByDay.get(group.dia).push(group);
  });
  const orderedDays = [...groupsByDay.keys()].sort((first, second) => {
    const firstIndex = dayOrder.indexOf(first);
    const secondIndex = dayOrder.indexOf(second);
    return (firstIndex === -1 ? dayOrder.length : firstIndex)
      - (secondIndex === -1 ? dayOrder.length : secondIndex);
  });
  groupList.innerHTML = orderedDays.map((day) => `
    <section class="day-group" aria-labelledby="day-${dayOrder.indexOf(day)}">
      <div class="day-group-heading">
        <h3 id="day-${dayOrder.indexOf(day)}">${escapeHtml(day)}</h3>
        <span>${groupsByDay.get(day).length} ${groupsByDay.get(day).length === 1 ? "grupo" : "grupos"}</span>
      </div>
      <div class="group-grid">${groupsByDay.get(day).map(getGroupCard).join("")}</div>
    </section>
  `).join("");
  revealGroupCards();
  groupList.setAttribute("aria-busy", "false");
  emptyState.hidden = visibleGroups.length > 0;
  const hasActiveFilters = filterMode !== "all" || groupSearch.value.trim().length > 0;
  resetFiltersButton.hidden = !hasActiveFilters;
  if (!hasActiveFilters) {
    resultsSummary.textContent = `Mostrando todos los grupos (${groups.length})`;
  } else {
    const countLabel = `${visibleGroups.length} ${visibleGroups.length === 1 ? "grupo" : "grupos"}`;
    const context = [];
    if (filterMode === "day") {
      context.push(`los ${filterSelect.value.toLocaleLowerCase("es")}`);
    } else if (filterMode === "zone") {
      context.push(filterSelect.value === "Virtual"
        ? (visibleGroups.length === 1 ? "virtual" : "virtuales")
        : `en ${filterSelect.value}`);
    }
    if (groupSearch.value.trim()) {
      context.push(`para “${groupSearch.value.trim()}”`);
    }
    resultsSummary.textContent = `Mostrando ${countLabel}${context.length ? ` ${context.join(" ")}` : " que coinciden con tu búsqueda"}`;
  }
}

function configureFilterOptions() {
  const values = filterMode === "day"
    ? [...new Set(groups.map((group) => group.dia))]
    : [...new Set(groups.map((group) => group.zona))]
      .sort((first, second) => {
        if (first === "Virtual") {
          return 1;
        }
        if (second === "Virtual") {
          return -1;
        }
        return first.localeCompare(second, "es");
      });
  const previousValue = filterSelect.value;
  filterLabel.textContent = filterMode === "day" ? "Elige un día" : "Elige una zona";
  filterSelect.replaceChildren(...values.map((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    return option;
  }));
  if (values.includes(previousValue)) {
    filterSelect.value = previousValue;
  }
  filterSelectWrap.hidden = filterMode === "all";
}

function setFilterMode(mode) {
  filterMode = mode;
  document.querySelectorAll(".filter-tab").forEach((tab) => {
    const isActive = tab.dataset.filterMode === mode;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-pressed", String(isActive));
  });
  configureFilterOptions();
  renderGroups();
}

function resetFilters() {
  groupSearch.value = "";
  setFilterMode("all");
}

function showLoadError(error) {
  console.error("No se pudieron cargar los grupos:", error);
  groupList.innerHTML = '<p class="load-error">No pudimos cargar los grupos. Recarga la página para intentarlo de nuevo.</p>';
    groupList.setAttribute("aria-busy", "false");
    resultsSummary.textContent = "No se pudieron cargar los grupos.";
  }

function openDavidHerreraWhatsApp(group = null) {
  const groupLocation = group
    ? group.zona === group.lugar
      ? group.lugar
      : `${group.zona}, ${group.lugar}`
    : "";
  const leaders = group?.lideres ?? [];
  const leadersLabel = leaders.length === 1 ? "Líder" : "Líderes";
  const message = group
    ? `Hola, David 👋

Vi la página de la Red Living y me interesa integrarme a un grupo de amistad.

📍 Grupo: ${groupLocation}
👥 ${leadersLabel}: ${leaders.join(", ")}
🗓️ Día: ${group.dia}
🕒 Hora: ${formatTime(group.hora)}

¿Me cuentas cómo puedo participar? ¡Gracias!`
    : `Hola, David 👋

Quiero ser parte de un grupo de amistad de la Red Living.

¿Me ayudas a encontrar uno y me cuentas cómo puedo integrarme? ¡Gracias!`;
  pendingWhatsAppUrl = `https://wa.me/${davidHerreraPhone}?text=${encodeURIComponent(message)}`;
  redirectDialog.showModal();
}

function startWhatsAppRedirect() {
  if (!pendingWhatsAppUrl || redirectTimeout !== null) {
    return;
  }
  redirectDialog.classList.add("is-loading");
  redirectDialog.setAttribute("aria-labelledby", "redirect-loading");
  redirectLoader.hidden = false;
  redirectLoading.hidden = false;
  redirectTimeout = window.setTimeout(() => {
    window.location.assign(pendingWhatsAppUrl);
  }, 1400);
}

redirectContinue.addEventListener("click", startWhatsAppRedirect);

redirectClose.addEventListener("click", () => redirectDialog.close());

redirectDialog.addEventListener("click", (event) => {
  if (event.target === redirectDialog) {
    redirectDialog.close();
  }
});

function resetRedirectState() {
  window.clearTimeout(redirectTimeout);
  redirectTimeout = null;
  pendingWhatsAppUrl = null;
  redirectDialog.classList.remove("is-loading");
  redirectDialog.setAttribute("aria-labelledby", "redirect-title");
  redirectLoader.hidden = true;
  redirectLoading.hidden = true;
}

redirectDialog.addEventListener("close", resetRedirectState);

window.addEventListener("pagehide", () => {
  if (redirectDialog.open) {
    redirectDialog.close();
  }
  resetRedirectState();
});

window.addEventListener("pageshow", () => {
  if (redirectDialog.open) {
    redirectDialog.close();
  }
  resetRedirectState();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && redirectDialog.classList.contains("is-loading")) {
    if (redirectDialog.open) {
      redirectDialog.close();
    }
    resetRedirectState();
  }
});

document.querySelectorAll(".filter-tab").forEach((tab) => {
  tab.addEventListener("click", () => setFilterMode(tab.dataset.filterMode));
});

filterSelect.addEventListener("change", renderGroups);

document.addEventListener("click", (event) => {
  const joinButton = event.target.closest(".join-button");
  if (!joinButton) {
    return;
  }
  const group = groups.find((item) => item.id === joinButton.dataset.groupId);
  if (group) {
    openDavidHerreraWhatsApp(group);
  }
});

groupSearch.addEventListener("input", renderGroups);
resetFiltersButton.addEventListener("click", resetFilters);
emptyResetButton.addEventListener("click", resetFilters);
generalContact.addEventListener("click", () => openDavidHerreraWhatsApp());

fetch("groups.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error(`groups.json respondió con estado ${response.status}`);
    }
    return response.json();
  })
  .then((data) => {
    if (!Array.isArray(data.grupos)) {
      throw new Error("groups.json no contiene una lista válida de grupos");
    }
    groups = data.grupos;
    renderGroups();
  })
  .catch(showLoadError);
