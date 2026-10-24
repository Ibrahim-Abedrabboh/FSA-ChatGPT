import { handleAuthCallback } from "@netlify/identity";
const form = document.querySelector("#loginForm");
const status = document.querySelector("#status");
const button = document.querySelector("#submit");
let inviteToken = null;
button.disabled = true;
async function initialize() {
  // Only invitations are supported here. Other callback types must not create a browser-stored session.
  const params = new URLSearchParams(location.hash.slice(1));
  if (["access_token", "recovery_token", "confirmation_token", "email_change_token"].some(key => params.has(key))) {
    history.replaceState(null, "", "/");
    status.textContent = "This link type is not supported. Ask the workspace owner for a new invitation.";
    return;
  }
  try {
    const callback = await handleAuthCallback();
    if (callback?.type === "invite") {
      inviteToken = callback.token;
      document.querySelector("#heading").textContent = "Your owner workspace.";
      document.querySelector("#description").textContent = "Create your password to accept the invitation. Use at least 12 characters.";
      document.querySelector("#emailField").hidden = true;
      document.querySelector("#email").required = false;
      document.querySelector("#password").minLength = 12;
      document.querySelector("#password").autocomplete = "new-password";
      button.textContent = "Accept invitation →";
    }
    const settings = await fetch("/.netlify/identity/settings", { cache: "no-store" });
    if (!settings.ok) throw new Error("Unavailable");
    const me = await fetch("/api/owner/me", { cache: "no-store" });
    if (me.ok) { location.replace("/owner/"); return; }
    status.textContent = inviteToken ? "Your invitation is ready." : "Use the email address that received your invitation.";
    button.disabled = false;
  } catch { status.textContent = "Sign-in is unavailable. Please try again shortly."; }
}
form.addEventListener("submit", async event => {
  event.preventDefault(); button.disabled = true; status.textContent = "Signing in…";
  try {
    const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: inviteToken ? "invite" : "login", token: inviteToken, email: form.email.value.trim(), password: form.password.value }) });
    form.password.value = "";
    if (response.ok) { location.replace("/owner/"); return; }
    status.textContent = response.status === 403 ? "Your account needs the owner role. Contact the workspace administrator." : response.status === 429 ? "Too many attempts. Please wait a minute." : response.status === 503 ? "Sign-in is temporarily unavailable. Please try again." : "Sign-in failed. Check your details or request a fresh invitation.";
  } catch { status.textContent = "Connection failed. Please try again."; }
  finally { button.disabled = false; }
});
initialize();
