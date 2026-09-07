const statusEl = document.getElementById("dash-status");
const galleryEl = document.getElementById("gallery-grid");
const downloadsEl = document.getElementById("downloads-list");

const TYPE_LABELS = {
  file: "FILE",
  video: "MP4",
  mp4: "MP4",
  image: "IMG"
};

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
    const badge = document.createElement("span");
    badge.className = "download-badge";
    badge.textContent = TYPE_LABELS[item.type || extensionType(item.file)] || "FILE";
    badgeCell.append(badge);

    const linkCell = document.createElement("td");
    const link = document.createElement("a");
    link.href = item.file;
    link.download = "";
    link.textContent = item.title || item.file;
    linkCell.append(link);

    row.append(badgeCell, linkCell);
    downloadsEl.append(row);
  }
}

loadLibrary();

const hitCountEl = document.getElementById("hit-count");
if (hitCountEl) {
  const base = 40000 + Math.floor(Math.random() * 2000);
  hitCountEl.textContent = String(base).padStart(6, "0");
}
