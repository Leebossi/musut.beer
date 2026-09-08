const statusEl = document.getElementById("dash-status");
const downloadsEl = document.getElementById("downloads-list");
const guestbookListEl = document.getElementById("guestbook-list");
const guestbookFormEl = document.getElementById("guestbook-form");
const guestbookNameEl = document.getElementById("guestbook-name");
const guestbookMessageEl = document.getElementById("guestbook-message");
const guestbookFeedbackEl = document.getElementById("guestbook-feedback");

const GUESTBOOK_API = "/api/guestbook";

const TYPE_LABELS = {
  file: "FILE",
  video: "MP4",
  mp4: "MP4",
  image: "IMG"
};

const TYPE_ICONS = {
  image: "🖼️"
};

const TYPE_IMAGE_ICONS = {
  video: "assets/img/video.png",
  mp4: "assets/img/video.png",
  file: "assets/img/file.png"
};

function createTypeIcon(resolvedType) {
  const imageSrc = TYPE_IMAGE_ICONS[resolvedType];
  if (imageSrc) {
    const img = document.createElement("img");
    img.className = "download-icon";
    img.src = imageSrc;
    img.alt = "";
    return img;
  }

  const icon = document.createElement("span");
  icon.className = "download-icon";
  icon.textContent = TYPE_ICONS[resolvedType] || TYPE_ICONS.file;
  return icon;
}

function extensionType(fileName) {
  const ext = String(fileName).split(".").pop().toLowerCase();
  if (ext === "mp4") return "video";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
  return "file";
}

async function loadLibrary() {
  try {
    const response = await fetch(`library.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const library = await response.json();
    statusEl.textContent = library.title || "Library loaded.";
    renderDownloads(library.downloads || []);
  } catch (error) {
    statusEl.textContent = "Failed to load library.";
  }

  loadGuestbook();
}

async function loadGuestbook() {
  try {
    const response = await fetch(`${GUESTBOOK_API}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const data = await response.json();
    renderGuestbook(data.entries || []);
  } catch (error) {
    guestbookListEl.innerHTML = "<p>Failed to load guestbook.</p>";
  }
}

function renderGuestbook(entries) {
  guestbookListEl.innerHTML = "";
  if (entries.length === 0) {
    guestbookListEl.innerHTML = "<p>No entries yet. Be the first to sign!</p>";
    return;
  }

  for (const entry of entries) {
    const entryEl = document.createElement("div");
    entryEl.className = "guestbook-entry";

    const headerEl = document.createElement("div");
    headerEl.className = "guestbook-entry-header";

    const nameEl = document.createElement("span");
    nameEl.className = "guestbook-name";
    nameEl.textContent = entry.name || "anon";

    const dateEl = document.createElement("span");
    dateEl.className = "guestbook-date";
    dateEl.textContent = entry.date || "";

    headerEl.append(nameEl, dateEl);

    const messageEl = document.createElement("p");
    messageEl.className = "guestbook-message";
    messageEl.textContent = entry.message || "";

    entryEl.append(headerEl, messageEl);
    guestbookListEl.append(entryEl);
  }
}

if (guestbookFormEl) {
  guestbookFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = guestbookNameEl.value.trim();
    const message = guestbookMessageEl.value.trim();
    if (!name || !message) return;

    if (guestbookFeedbackEl) guestbookFeedbackEl.textContent = "";

    try {
      const response = await fetch(GUESTBOOK_API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, message })
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      guestbookFormEl.reset();
      await loadGuestbook();
    } catch (error) {
      if (guestbookFeedbackEl) guestbookFeedbackEl.textContent = "Failed to sign the guestbook. Please try again.";
    }
  });
}

function renderDownloads(items) {
  downloadsEl.innerHTML = "";
  if (items.length === 0) {
    downloadsEl.innerHTML = "<p>No downloads yet.</p>";
    return;
  }

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "download-item";

    const badgeCell = document.createElement("div");
    badgeCell.className = "download-badge-cell";
    const resolvedType = item.type || extensionType(item.file);

    const icon = createTypeIcon(resolvedType);

    const badge = document.createElement("span");
    badge.className = "download-badge";
    badge.textContent = TYPE_LABELS[resolvedType] || "FILE";

    badgeCell.append(icon, badge);

    const linkCell = document.createElement("div");
    linkCell.className = "download-link-cell";

    if (resolvedType === "video" || resolvedType === "mp4") {
      const watchLink = document.createElement("a");
      watchLink.href = item.file;
      watchLink.textContent = "▶ Watch " + (item.title || item.file);
      watchLink.addEventListener("click", (event) => {
        event.preventDefault();
        openVideoModal(item.file);
      });
      linkCell.append(watchLink, document.createTextNode(""));
    }

    const link = document.createElement("a");
    link.href = item.file;
    link.download = "";
    const downloadIcon = document.createElement("img");
    downloadIcon.className = "download-link-icon";
    downloadIcon.src = "assets/img/download.png";
    downloadIcon.alt = "Download";
    link.append(downloadIcon);
    linkCell.append(link);

    row.append(badgeCell, linkCell);
    downloadsEl.append(row);
  }
}

const videoModalEl = document.getElementById("video-modal");
const videoModalPlayerEl = document.getElementById("video-modal-player");
const videoModalCloseEl = document.getElementById("video-modal-close");

function openVideoModal(src) {
  if (!videoModalEl || !videoModalPlayerEl) return;
  videoModalPlayerEl.src = src;
  videoModalEl.hidden = false;
  videoModalPlayerEl.play().catch(() => {});
}

function closeVideoModal() {
  if (!videoModalEl || !videoModalPlayerEl) return;
  videoModalPlayerEl.pause();
  videoModalPlayerEl.removeAttribute("src");
  videoModalPlayerEl.load();
  videoModalEl.hidden = true;
}

if (videoModalCloseEl) {
  videoModalCloseEl.addEventListener("click", closeVideoModal);
}
if (videoModalEl) {
  videoModalEl.addEventListener("click", (event) => {
    if (event.target === videoModalEl) closeVideoModal();
  });
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeVideoModal();
});

loadLibrary();

const hitCountEl = document.getElementById("hit-count");
if (hitCountEl) {
  const base = 40000 + Math.floor(Math.random() * 2000);
  hitCountEl.textContent = String(base).padStart(6, "0");
}
