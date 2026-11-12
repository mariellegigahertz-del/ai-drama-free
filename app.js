const starterClips = [
  { id: "demo-train", title: "The Last Train Home", genre: "Romance", duration: "2 min", creator: "Demo catalog", description: "Two strangers share one final ride through a city that never sleeps.", art: "pink", demo: true },
  { id: "demo-blue-hour", title: "The Blue Hour", genre: "Mystery", duration: "3 min", creator: "Demo catalog", description: "A missing photograph reveals a secret hidden in plain sight.", art: "blue", demo: true },
  { id: "demo-golden", title: "A Borrowed Summer", genre: "Romance", duration: "1 min", creator: "Demo catalog", description: "One letter. One summer. A promise that outlives them both.", art: "gold", demo: true },
  { id: "demo-signal", title: "Signal from Tomorrow", genre: "Sci-Fi", duration: "4 min", creator: "Demo catalog", description: "A late-night radio host receives a call from the future.", art: "green", demo: true },
  { id: "demo-moon", title: "The Moon's Keeper", genre: "Fantasy", duration: "2 min", creator: "Demo catalog", description: "The quiet guardian of a sleeping moon makes one last wish.", art: "violet", demo: true },
  { id: "demo-window", title: "Window 17", genre: "Mystery", duration: "3 min", creator: "Demo catalog", description: "Every night, the same lit window appears in an empty building.", art: "cyan", demo: true }
];

const storageKeys = { saved: "aidf.saved.v1", viewed: "aidf.viewed.v1" };
const bucketName = "drama-videos";
const maxVideoSize = 50 * 1024 * 1024;
const grid = document.querySelector("#video-grid");
const searchInput = document.querySelector("#search-input");
const count = document.querySelector("#result-count");
const detailDialog = document.querySelector("#detail-dialog");
const addDialog = document.querySelector("#add-dialog");
const accountDialog = document.querySelector("#account-dialog");
const watchDialog = document.querySelector("#watch-dialog");
const reportDialog = document.querySelector("#report-dialog");
const toast = document.querySelector("#toast");
const supabaseReady = Boolean(
  window.supabase && window.APP_SUPABASE_CONFIG?.url &&
  window.APP_SUPABASE_CONFIG?.anonKey &&
  !window.APP_SUPABASE_CONFIG.url.includes("YOUR_PROJECT")
);
const backendClient = supabaseReady
  ? window.supabase.createClient(window.APP_SUPABASE_CONFIG.url, window.APP_SUPABASE_CONFIG.anonKey)
  : null;

let activeView = "discover";
let activeFilter = "All";
let clips = [...starterClips];
let currentUser = null;
let accountMode = "login";
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

function getSaved() { return new Set(readStorage(storageKeys.saved, [])); }

function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function showError(action, error) {
  console.error(`${action} failed:`, error);
  showToast(`${action} failed. ${error?.message || "Please try again."}`);
}

function updateAccountButton() {
  const button = document.querySelector("#account-button");
  button.textContent = currentUser ? "Sign out" : "Sign in";
  button.title = currentUser?.email || "Sign in or create an account";
  document.querySelector("#add-button").hidden = !currentUser || activeView !== "library";
}

function mapRemoteVideo(row) {
  const { data } = backendClient.storage.from(bucketName).getPublicUrl(row.storage_path);
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    genre: row.genre,
    creator: row.creator_name,
    licenseType: row.license_type,
    licenseUrl: row.license_url,
    videoUrl: data.publicUrl,
    storagePath: row.storage_path,
    views: row.views,
    createdAt: row.created_at,
    art: ["pink", "blue", "gold", "green", "violet", "cyan"][row.id.charCodeAt(0) % 6],
    demo: false
  };
}

async function loadCommunityVideos() {
  if (!backendClient) {
    clips = [...starterClips];
    render();
    return;
  }
  const { data, error } = await backendClient.from("drama_videos")
    .select("id,user_id,title,description,genre,creator_name,license_type,license_url,storage_path,views,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    showError("Loading community videos", error);
    return;
  }
  clips = [...data.map(mapRemoteVideo), ...starterClips];
  render();
}

function setView(view) {
  activeView = view;
  document.querySelectorAll(".nav-item").forEach(button => {
    const isActive = button.dataset.view === view;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  });
  const isLibrary = view === "library";
  document.querySelector("#section-kicker").textContent = isLibrary ? "YOUR STORIES" : view === "saved" ? "YOUR WATCHLIST" : "THE STORY SHELF";
  document.querySelector("#section-title").textContent = isLibrary ? "My Library" : view === "saved" ? "Saved dramas" : "Discover dramas";
  document.querySelector("#filter-row").hidden = view !== "discover";
  document.querySelector("#add-button").hidden = !currentUser || !isLibrary;
  render();
}

function getVisibleClips() {
  const search = searchInput.value.trim().toLowerCase();
  const saved = getSaved();
  return clips.filter(clip => {
    if (activeView === "saved" && !saved.has(clip.id)) return false;
    if (activeView === "library" && (!currentUser || clip.userId !== currentUser.id)) return false;
    if (activeView === "discover" && activeFilter !== "All" && clip.genre !== activeFilter) return false;
    return !search || [clip.title, clip.genre, clip.description, clip.creator].some(value => value && value.toLowerCase().includes(search));
  });
}

function render() {
  const visibleClips = getVisibleClips();
  count.textContent = `${visibleClips.length} ${visibleClips.length === 1 ? "story" : "stories"}`;
  if (!visibleClips.length) {
    const message = activeView === "saved" ? "Save a story to find it here." :
      activeView === "library" ? (currentUser ? "Upload your first drama to share it with the community." : "Sign in to see and manage your stories.") :
        "Try another search or genre.";
    grid.innerHTML = `<div class="empty-state"><h3>No dramas here yet</h3><p>${escapeText(message)}</p></div>`;
    return;
  }
  const saved = getSaved();
  grid.innerHTML = visibleClips.map(clip => {
    const savedClip = saved.has(clip.id);
    const label = clip.demo ? "Catalog demo" : "Community video";
    const license = clip.demo ? "Preview only" : escapeText(clip.licenseType);
    return `<article class="video-card">
      <button class="poster" data-art="${escapeText(clip.art || "pink")}" type="button" data-watch="${escapeText(clip.id)}" aria-label="Watch ${escapeText(clip.title)}">
        <span class="poster-label">${label}</span>
        <span class="poster-play" aria-hidden="true">▶</span>
        <span class="poster-title">${escapeText(clip.title)}</span>
      </button>
      <div class="card-body">
        <div class="card-topline"><span class="genre-tag">${escapeText(clip.genre)}</span><span class="duration">${clip.demo ? escapeText(clip.duration) : `${Number(clip.views) || 0} views`}</span></div>
        <h3>${escapeText(clip.title)}</h3>
        <p class="card-description">${escapeText(clip.description || "A short drama from the community.")}</p>
        <div class="card-footer"><span>${license}</span>
          <div class="card-actions">
            <button class="save-button${savedClip ? " saved" : ""}" type="button" data-save="${escapeText(clip.id)}" aria-label="${savedClip ? "Remove from" : "Add to"} saved dramas">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1z"/></svg>
            </button>
            <button class="details-button" type="button" data-details="${escapeText(clip.id)}">Details ↗</button>
          </div>
        </div>
      </div>
    </article>`;
  }).join("");
}

function openAccountDialog(mode = "login") {
  if (!backendClient) {
    showToast("Community accounts are not connected yet. Follow the Supabase setup in README.");
    return;
  }
  setAccountMode(mode);
  accountDialog.showModal();
}

function setAccountMode(mode) {
  accountMode = mode;
  const isSignup = mode === "signup";
  document.querySelector("#account-title").textContent = isSignup ? "Create your account" : "Sign in";
  document.querySelector("#account-submit").textContent = isSignup ? "Create account" : "Sign in";
  document.querySelector("#account-mode-button").textContent = isSignup ? "Already have an account? Sign in" : "New here? Create an account";
  document.querySelector('[name="password"]').autocomplete = isSignup ? "new-password" : "current-password";
}

async function openWatchDialog(id) {
  const clip = clips.find(item => item.id === id);
  if (!clip) return;
  const content = document.querySelector("#watch-content");
  const rights = clip.demo
    ? "Illustrative sample only. No video is attached."
    : `${escapeText(clip.licenseType)}. Creator-supplied rights information is not independently verified.`;
  content.innerHTML = `<p class="eyebrow">${escapeText(clip.genre)}${clip.demo ? " · SAMPLE" : ""}</p>
    <h2>${escapeText(clip.title)}</h2>
    ${clip.demo ? `<div class="detail-poster" data-art="${escapeText(clip.art)}">${escapeText(clip.title)}</div><p class="detail-description">This is an illustrative listing, not a real video.</p>` : `<video class="video-player" src="${escapeText(clip.videoUrl)}" controls playsinline preload="metadata"></video>`}
    <p class="detail-description">${escapeText(clip.description)}</p>
    <div class="license-note"><strong>By ${escapeText(clip.creator)}</strong><br>${rights}${clip.licenseUrl ? `<br><a class="license-link" href="${escapeText(clip.licenseUrl)}" target="_blank" rel="noopener noreferrer">License details ↗</a>` : ""}</div>
    <div class="dialog-actions"><span class="views-count">${clip.demo ? "Sample story" : `${Number(clip.views) || 0} views`}</span>
    ${clip.demo ? "" : `<button type="button" data-report="${escapeText(clip.id)}">Report video</button>${currentUser?.id === clip.userId ? `<button type="button" data-delete="${escapeText(clip.id)}">Delete my video</button>` : ""}`}<button type="button" data-close>Close</button></div>`;
  watchDialog.showModal();
  const player = content.querySelector("video");
  if (player) player.addEventListener("play", () => countView(clip), { once: true });
}

async function countView(clip) {
  const viewKey = `${storageKeys.viewed}.${clip.id}`;
  try {
    if (sessionStorage.getItem(viewKey)) return;
    sessionStorage.setItem(viewKey, "1");
  } catch (error) {
    console.warn("Could not save this session's view marker:", error);
  }
  const { data, error } = await backendClient.rpc("increment_drama_view", { p_video_id: clip.id });
  if (error) {
    showError("Counting video view", error);
    return;
  }
  clip.views = data;
  const viewLabel = document.querySelector(".views-count");
  if (viewLabel) viewLabel.textContent = `${Number(data) || 0} views`;
  render();
}

async function submitAccount(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const formData = new FormData(form);
  const credentials = { email: String(formData.get("email")).trim(), password: String(formData.get("password")) };
  const result = accountMode === "signup"
    ? await backendClient.auth.signUp(credentials)
    : await backendClient.auth.signInWithPassword(credentials);
  if (result.error) {
    showError(accountMode === "signup" ? "Creating account" : "Signing in", result.error);
    return;
  }
  if (accountMode === "signup" && !result.data.session) {
    showToast("Check your email to confirm your new account, then sign in.");
    form.reset();
    return;
  }
  currentUser = result.data.user;
  accountDialog.close();
  updateAccountButton();
  await loadCommunityVideos();
  showToast(accountMode === "signup" ? "Account created" : "Signed in");
}

async function submitUpload(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  if (!backendClient || !currentUser) {
    showToast("Sign in to upload a drama.");
    accountDialog.showModal();
    return;
  }
  const data = new FormData(form);
  const file = data.get("video");
  const licenseType = String(data.get("licenseType"));
  const licenseUrl = String(data.get("licenseUrl")).trim();
  if (!(file instanceof File) || !file.size) {
    showToast("Choose a video file to upload.");
    return;
  }
  if (file.size > maxVideoSize) {
    showToast("This video is over the 50 MB upload limit.");
    return;
  }
  if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) {
    showToast("Choose an MP4, WebM, or MOV video file.");
    return;
  }
  if (licenseType !== "All rights reserved — view only" && !/^https:\/\//i.test(licenseUrl)) {
    showToast("Add a secure HTTPS link to the Creative Commons license.");
    return;
  }

  const extension = file.name.split(".").pop().toLowerCase();
  const path = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await backendClient.storage.from(bucketName).upload(path, file, {
    contentType: file.type,
    upsert: false
  });
  if (uploadError) {
    showError("Uploading video", uploadError);
    return;
  }
  const row = {
    user_id: currentUser.id,
    title: String(data.get("title")).trim(),
    description: String(data.get("description")).trim(),
    genre: String(data.get("genre")),
    creator_name: String(data.get("creator")).trim(),
    license_type: licenseType,
    license_url: licenseUrl || null,
    storage_path: path
  };
  const { error: insertError } = await backendClient.from("drama_videos").insert(row);
  if (insertError) {
    const { error: cleanupError } = await backendClient.storage.from(bucketName).remove([path]);
    if (cleanupError) console.error("Could not remove the unlisted upload after database save failed:", cleanupError);
    showError("Publishing video", insertError);
    return;
  }
  form.reset();
  addDialog.close();
  await loadCommunityVideos();
  setView("library");
  showToast("Your drama is published.");
}

async function submitReport(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!currentUser) {
    reportDialog.close();
    openAccountDialog();
    return;
  }
  const data = new FormData(form);
  const { error } = await backendClient.from("video_reports").insert({
    video_id: String(data.get("videoId")),
    reporter_id: currentUser.id,
    reason: String(data.get("reason"))
  });
  if (error) {
    showError("Sending report", error);
    return;
  }
  form.reset();
  reportDialog.close();
  showToast("Report sent. Thank you for helping keep the community safe.");
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

grid.addEventListener("click", async event => {
  const saveButton = event.target.closest("[data-save]");
  if (saveButton) {
    const saved = getSaved();
    const id = saveButton.dataset.save;
    saved.has(id) ? saved.delete(id) : saved.add(id);
    localStorage.setItem(storageKeys.saved, JSON.stringify([...saved]));
    render();
    return;
  }
  const watchButton = event.target.closest("[data-watch]");
  if (watchButton) {
    await openWatchDialog(watchButton.dataset.watch);
    return;
  }
  const detailButton = event.target.closest("[data-details]");
  if (detailButton) await openWatchDialog(detailButton.dataset.details);
});

document.querySelector("#account-button").addEventListener("click", async () => {
  if (!currentUser) {
    openAccountDialog();
    return;
  }
  const { error } = await backendClient.auth.signOut();
  if (error) {
    showError("Signing out", error);
    return;
  }
  currentUser = null;
  updateAccountButton();
  await loadCommunityVideos();
  render();
  showToast("Signed out");
});

document.querySelector("#account-mode-button").addEventListener("click", () => {
  setAccountMode(accountMode === "login" ? "signup" : "login");
});
document.querySelector("#account-form").addEventListener("submit", submitAccount);
document.querySelector("#add-button").addEventListener("click", () => {
  if (!currentUser) {
    openAccountDialog();
    return;
  }
  addDialog.showModal();
});
document.querySelector("#add-form").addEventListener("submit", submitUpload);
document.querySelector("#report-form").addEventListener("submit", submitReport);

document.addEventListener("click", event => {
  if (event.target.matches("[data-close]")) event.target.closest("dialog").close();
  const deleteButton = event.target.closest("[data-delete]");
  if (deleteButton) removeVideo(deleteButton.dataset.delete);
  const reportButton = event.target.closest("[data-report]");
  if (reportButton) {
    document.querySelector('[name="videoId"]').value = reportButton.dataset.report;
    watchDialog.close();
    if (!currentUser) {
      showToast("Sign in before reporting a video.");
      openAccountDialog();
      return;
    }
    reportDialog.showModal();
  }
});

async function removeVideo(id) {
  const clip = clips.find(item => item.id === id);
  if (!clip || clip.userId !== currentUser?.id || !window.confirm("Delete this video from the community? This cannot be undone.")) return;
  const { error: rowError } = await backendClient.from("drama_videos").delete().eq("id", id);
  if (rowError) {
    showError("Deleting video", rowError);
    return;
  }
  const { error: fileError } = await backendClient.storage.from(bucketName).remove([clip.storagePath]);
  clips = clips.filter(item => item.id !== id);
  watchDialog.close();
  render();
  if (fileError) {
    console.error("The video listing was deleted but its stored file could not be removed:", fileError);
    showToast("Video removed, but its storage file needs cleanup in Supabase.");
    return;
  }
  showToast("Video deleted");
}

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

if (backendClient) {
  backendClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    updateAccountButton();
    render();
  });
  backendClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      showError("Restoring sign-in", error);
      return;
    }
    currentUser = data.session?.user || null;
    updateAccountButton();
    loadCommunityVideos();
  });
} else {
  document.querySelector("#catalog-notice p").innerHTML =
    "<strong>Demo mode:</strong> sample stories are illustrative, not playable. To enable community accounts, uploads, and watching, connect a Supabase project using the setup guide in README.md.";
  updateAccountButton();
  render();
}

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(error => {
    console.error("Could not register the offline app worker:", error);
  }));
}
