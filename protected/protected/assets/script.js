const stampEl = document.getElementById("timestamp");

if (stampEl) {
  const timestamp = new Date().toLocaleString();
  stampEl.textContent = `Loaded at ${timestamp}`;
}
