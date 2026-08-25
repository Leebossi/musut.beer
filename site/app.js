const form = document.getElementById("unlock-form");
const statusEl = document.getElementById("status");
const protectedLink = document.getElementById("protected-link");
const countdownTimeEl = document.getElementById("countdown-time");

const targetDate = new Date("2026-09-18T00:00:00");

function updateCountdown() {
  if (!countdownTimeEl) {
    return;
  }

  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    countdownTimeEl.textContent = "It is 18.9.2026.";
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

if (form && statusEl && protectedLink) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const passphrase = String(formData.get("passphrase") || "");

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

      statusEl.textContent = "Unlocked. You can open protected content now.";
      protectedLink.hidden = false;
    } catch (error) {
      statusEl.textContent = "Unlock request failed. Try again.";
    }
  });
}
