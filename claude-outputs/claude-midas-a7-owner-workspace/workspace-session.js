(async () => {
  try {
    const response = await fetch("/api/owner/me", { cache: "no-store" });
    if (!response.ok) { location.replace("/"); return; }
  } catch { location.replace("/"); return; }
  const button = document.createElement("button");
  button.type = "button"; button.className = "session-signout"; button.textContent = "Sign out";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const response = await fetch("/api/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign-out failed");
      location.replace("/");
    } catch { button.textContent = "Retry sign out"; button.disabled = false; }
  });
  document.querySelector(".topbar-right").append(button);
})();
