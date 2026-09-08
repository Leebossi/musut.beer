const statusEl = document.getElementById("dash-status");
const galleryEl = document.getElementById("gallery-grid");
const downloadsEl = document.getElementById("downloads-list");

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
    renderGallery(library.gallery || []);
    renderDownloads(library.downloads || []);
  } catch (error) {
    statusEl.textContent = "Failed to load library.";
  }
}

function renderGallery(items) {
  galleryEl.innerHTML = "";
  if (items.length === 0) {
    galleryEl.innerHTML = "<tr><td>No gallery items yet.</td></tr>";
    return;
  }

  const row = document.createElement("tr");
  for (const item of items) {
    const cell = document.createElement("td");
    cell.className = "gallery-item";

    const link = document.createElement("a");
    link.href = item.src;
    link.target = "_blank";
    link.rel = "noopener";

    const img = document.createElement("img");
    img.src = item.src;
    img.alt = item.title || "";
    img.loading = "lazy";

    const caption = document.createElement("span");
    caption.className = "gallery-caption";
    caption.textContent = item.title || item.src;

    link.append(img);
    cell.append(link, document.createElement("br"), caption);
    row.append(cell);
  }
  galleryEl.append(row);
}

function renderDownloads(items) {
  downloadsEl.innerHTML = "";
  if (items.length === 0) {
    downloadsEl.innerHTML = "<tr><td>No downloads yet.</td></tr>";
    return;
  }

  for (const item of items) {
    const row = document.createElement("tr");
    row.className = "download-item";

    const badgeCell = document.createElement("td");
    const resolvedType = item.type || extensionType(item.file);

    const icon = createTypeIcon(resolvedType);

    const badge = document.createElement("span");
    badge.className = "download-badge";
    badge.textContent = TYPE_LABELS[resolvedType] || "FILE";

    badgeCell.append(icon, badge);

    const linkCell = document.createElement("td");

    if (resolvedType === "video" || resolvedType === "mp4") {
      const watchLink = document.createElement("a");
      watchLink.href = item.file;
      watchLink.textContent = "▶ Watch";
      watchLink.addEventListener("click", (event) => {
        event.preventDefault();
        openVideoModal(item.file);
      });
      linkCell.append(watchLink, document.createTextNode(" | "));
    }

    const link = document.createElement("a");
    link.href = item.file;
    link.download = "";
    const downloadIcon = document.createElement("img");
    downloadIcon.className = "download-link-icon";
    downloadIcon.src = "assets/img/download.png";
    downloadIcon.alt = "Download";
    link.append(downloadIcon, document.createTextNode(item.title || item.file));
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
