const starterClips = [
  { id: "demo-train", title: "The Last Train Home", genre: "Romance", duration: "2 min", creator: "Demo catalog", description: "Two strangers share one final ride through a city that never sleeps.", art: "pink", demo: true },
  { id: "demo-blue-hour", title: "The Blue Hour", genre: "Mystery", duration: "3 min", creator: "Demo catalog", description: "A missing photograph reveals a secret hidden in plain sight.", art: "blue", demo: true },
  { id: "demo-golden", title: "A Borrowed Summer", genre: "Romance", duration: "1 min", creator: "Demo catalog", description: "One letter. One summer. A promise that outlives them both.", art: "gold", demo: true },
  { id: "demo-signal", title: "Signal from Tomorrow", genre: "Sci-Fi", duration: "4 min", creator: "Demo catalog", description: "A late-night radio host receives a call from the future.", art: "green", demo: true },
  { id: "demo-moon", title: "The Moon's Keeper", genre: "Fantasy", duration: "2 min", creator: "Demo catalog", description: "The quiet guardian of a sleeping moon makes one last wish.", art: "violet", demo: true },
  { id: "demo-window", title: "Window 17", genre: "Mystery", duration: "3 min", creator: "Demo catalog", description: "Every night, the same lit window appears in an empty building.", art: "cyan", demo: true }
];

const storageKeys = { clips: "aidf.userClips.v1", saved: "aidf.saved.v1" };
const grid = document.querySelector("#video-grid");
const searchInput = document.querySelector("#search-input");
const count = document.querySelector("#result-count");
const detailDialog = document.querySelector("#detail-dialog");
const addDialog = document.querySelector("#add-dialog");
const toast = document.querySelector("#toast");
let activeView = "discover";
let activeFilter = "All";
let toastTimer;
let deferredInstallPrompt;

function readStorage(key, fallback) {
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    return Array.isArray(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

function getUserClips() { return readStorage(storageKeys.clips, []); }
function getSaved() { return new Set(readStorage(storageKeys.saved, [])); }
function allClips() { return [...starterClips, ...getUserClips()]; }

function escapeText(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function setView(view) {
  activeView = view;
  document.querySelectorAll(".nav-item").forEach(button => {
    const isActive = button.dataset.view === view;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  });
  const isLibrary = view === "library";
  document.querySelector("#section-kicker").textContent = isLibrary ? "YOUR COLLECTION" : view === "saved" ? "YOUR WATCHLIST" : "THE STORY SHELF";
  document.querySelector("#section-title").textContent = isLibrary ? "My Library" : view === "saved" ? "Saved dramas" : "Discover dramas";
  document.querySelector("#filter-row").hidden = view !== "discover";
  document.querySelector("#add-button").hidden = view !== "library";
  render();
}

function getVisibleClips() {
  const search = searchInput.value.trim().toLowerCase();
  const saved = getSaved();
  return allClips().filter(clip => {
    if (activeView === "saved" && !saved.has(clip.id)) return false;
    if (activeView === "library" && clip.demo) return false;
    if (activeView === "discover" && activeFilter !== "All" && clip.genre !== activeFilter) return false;
    return !search || [clip.title, clip.genre, clip.description, clip.creator].some(value => value && value.toLowerCase().includes(search));
  });
}

function render() {
  const clips = getVisibleClips();
  count.textContent = `${clips.length} ${clips.length === 1 ? "story" : "stories"}`;
  if (!clips.length) {
    const message = activeView === "saved" ? "Save a story to find it here." : activeView === "library" ? "Your library is ready for its first clip." : "Try another search or genre.";
    grid.innerHTML = `<div class="empty-state"><h3>No dramas here yet</h3><p>${escapeText(message)}</p></div>`;
    return;
  }
  const saved = getSaved();
  grid.innerHTML = clips.map(clip => {
    const savedClip = saved.has(clip.id);
    const isDemo = Boolean(clip.demo);
    const license = isDemo ? "Preview only" : escapeText(clip.licenseType);
    return `<article class="video-card">
      <div class="poster" data-art="${escapeText(clip.art || "pink")}">
        <span class="poster-label">${isDemo ? "Catalog demo" : "My clip"}</span>
        <button class="save-button${savedClip ? " saved" : ""}" type="button" data-save="${escapeText(clip.id)}" aria-label="${savedClip ? "Remove from" : "Add to"} saved">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1z"/></svg>
        </button>
        <span class="poster-title">${escapeText(clip.title)}</span>
      </div>
      <div class="card-body">
        <div class="card-topline"><span class="genre-tag">${escapeText(clip.genre)}</span><span class="duration">${escapeText(clip.duration || "Short")}</span></div>
        <h3>${escapeText(clip.title)}</h3>
        <p class="card-description">${escapeText(clip.description || "A short drama from your personal collection.")}</p>
        <div class="card-footer"><span>${license}</span><button class="details-button" type="button" data-details="${escapeText(clip.id)}">Details ↗</button></div>
      </div>
    </article>`;
  }).join("");
}

function openDetails(id) {
  const clip = allClips().find(item => item.id === id);
  if (!clip) return;
  const isDemo = Boolean(clip.demo);
  const content = document.querySelector("#detail-content");
  const licenseUrl = clip.licenseUrl ? `<a class="license-link" href="${escapeText(clip.licenseUrl)}" target="_blank" rel="noopener noreferrer">Open license terms ↗</a>` : "No video or license is provided for this demo listing.";
  const creator = escapeText(clip.creator || "Not specified");
  content.innerHTML = `<div class="detail-poster" data-art="${escapeText(clip.art || "pink")}">${escapeText(clip.title)}</div>
    <div class="detail-meta"><span class="genre-tag">${escapeText(clip.genre)}</span><span class="duration">${escapeText(clip.duration || "Short")}</span></div>
    <h2>${escapeText(clip.title)}</h2>
    <p class="detail-description">${escapeText(clip.description || "")}</p>
    <div class="license-note"><strong>${isDemo ? "Illustrative catalog entry" : escapeText(clip.licenseType)}</strong><br>${isDemo ? "This entry is sample content only; it has no playable file and is not offered for download." : `Creator/source: ${creator}. Check the linked terms and provide any required attribution.`}<br>${licenseUrl}</div>
    <div class="dialog-actions">${isDemo ? "" : `<a class="primary-button" href="${escapeText(clip.videoUrl)}" target="_blank" rel="noopener noreferrer" download>Open / download video ↗</a><button type="button" data-delete="${escapeText(clip.id)}">Remove clip</button>`}<button type="button" data-close>Close</button></div>`;
  detailDialog.showModal();
}

document.querySelector("#filter-row").addEventListener("click", event => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".filter-chip").forEach(chip => chip.classList.toggle("active", chip === button));
  render();
});

document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
searchInput.addEventListener("input", render);

grid.addEventListener("click", event => {
  const saveButton = event.target.closest("[data-save]");
  if (saveButton) {
    const saved = getSaved();
    const id = saveButton.dataset.save;
    if (saved.has(id)) {
      saved.delete(id);
      showToast("Removed from saved dramas");
    } else {
      saved.add(id);
      showToast("Saved for later");
    }
    localStorage.setItem(storageKeys.saved, JSON.stringify([...saved]));
    render();
    return;
  }
  const detailButton = event.target.closest("[data-details]");
  if (detailButton) openDetails(detailButton.dataset.details);
});

document.querySelector("#add-button").addEventListener("click", () => addDialog.showModal());
document.querySelector("#add-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const videoUrl = String(data.get("videoUrl")).trim();
  const licenseUrl = String(data.get("licenseUrl")).trim();
  if (!/^https:\/\//i.test(videoUrl) || !/^https:\/\//i.test(licenseUrl)) {
    showToast("Use secure HTTPS links for the video and license");
    return;
  }
  const clip = {
    id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: String(data.get("title")).trim(),
    videoUrl,
    licenseUrl,
    licenseType: String(data.get("licenseType")),
    genre: String(data.get("genre")),
    creator: String(data.get("creator")).trim(),
    description: "Added to your personal library.",
    art: ["pink", "blue", "gold", "green", "violet", "cyan"][getUserClips().length % 6],
    demo: false
  };
  const clips = getUserClips();
  clips.unshift(clip);
  localStorage.setItem(storageKeys.clips, JSON.stringify(clips));
  form.reset();
  addDialog.close();
  setView("library");
  showToast("Clip added. Check its license before reuse.");
});

document.addEventListener("click", event => {
  if (event.target.matches("[data-close]")) event.target.closest("dialog").close();
  const deleteButton = event.target.closest("[data-delete]");
  if (deleteButton) {
    const id = deleteButton.dataset.delete;
    localStorage.setItem(storageKeys.clips, JSON.stringify(getUserClips().filter(clip => clip.id !== id)));
    localStorage.setItem(storageKeys.saved, JSON.stringify([...getSaved()].filter(savedId => savedId !== id)));
    detailDialog.close();
    render();
    showToast("Clip removed from your library");
  }
});

document.querySelectorAll("dialog").forEach(dialog => dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
}));

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.querySelector("#install-button").hidden = false;
});

document.querySelector("#install-button").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.querySelector("#install-button").hidden = true;
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(error => {
    console.error("Could not register the offline app worker:", error);
  }));
}

render();
