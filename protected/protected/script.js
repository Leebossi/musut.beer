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
    const response = await fetch("library.json");
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
    galleryEl.textContent = "No gallery items yet.";
    return;
  }

  for (const item of items) {
    const link = document.createElement("a");
    link.className = "gallery-item";
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

    link.append(img, caption);
    galleryEl.append(link);
  }
}

function renderDownloads(items) {
  downloadsEl.innerHTML = "";
  if (items.length === 0) {
    downloadsEl.textContent = "No downloads yet.";
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "download-item";

    const badge = document.createElement("span");
    badge.className = "download-badge";
    badge.textContent = TYPE_LABELS[item.type || extensionType(item.file)] || "FILE";

    const link = document.createElement("a");
    link.href = item.file;
    link.download = "";
    link.textContent = item.title || item.file;

    li.append(badge, link);
    downloadsEl.append(li);
  }
}

loadLibrary();
