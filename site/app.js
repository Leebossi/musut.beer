const form = document.getElementById("unlock-form");
const statusEl = document.getElementById("status");
const protectedLink = document.getElementById("protected-link");

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
