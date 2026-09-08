const form = document.getElementById("unlock-form");
const statusEl = document.getElementById("status");
const protectedLink = document.getElementById("protected-link");
const countdownTimeEl = document.getElementById("countdown-time");
const unlockCard = document.getElementById("unlock-card");
const countdownCard = document.getElementById("countdown-card");

if (protectedLink) {
  fetch(protectedLink.href, { credentials: "same-origin" })
    .then((response) => {
      if (response.ok && !response.redirected) {
        window.location.href = protectedLink.href;
      }
    })
    .catch(() => {});
}

const targetDate = new Date("2026-09-18T16:20:00");

function updateCountdown() {
  if (!countdownTimeEl) {
    return;
  }

  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    countdownTimeEl.textContent = "It is 18.9.2026.";
    if (unlockCard) {
      unlockCard.hidden = false;
    }
    if (countdownCard) {
      countdownCard.hidden = true;
    }
    return;
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  countdownTimeEl.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

updateCountdown();
setInterval(updateCountdown, 1000);

async function attemptUnlock(passphrase) {
  statusEl.textContent = "Verifying...";
  protectedLink.hidden = true;

  try {
    const response = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase })
    });

    if (!response.ok) {
      statusEl.textContent = "Invalid passphrase.";
      return;
    }

    statusEl.textContent = "Unlocked. Redirecting...";
    window.location.href = protectedLink.href;
  } catch (error) {
    statusEl.textContent = "Unlock request failed. Try again.";
  }
}

if (form && statusEl && protectedLink) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    attemptUnlock(String(formData.get("passphrase") || ""));
  });

  // Allow ?passphrase=... links to auto-unlock; strip it from the URL immediately so it isn't left in history.
  const urlPassphrase = new URLSearchParams(window.location.search).get("passphrase");
  if (urlPassphrase) {
    window.history.replaceState({}, "", window.location.pathname);
    attemptUnlock(urlPassphrase);
  }
}
