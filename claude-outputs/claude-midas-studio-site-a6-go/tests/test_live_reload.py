"""Live site, simulated studio replies (nothing leaves the browser). Reproduces: submit, reload, sign in again."""
import json, sys
from playwright.sync_api import sync_playwright
LIVE = 'https://claude-midas-studio-a6-live.netlify.app/'
STUDIO = 'https://ibrahimnewaeon.app.n8n.cloud/'
shot = lambda n, role, frame, props: {"shot": n, "role": role, "made_from_shot": 0 if n == 1 else 1, "frame": frame, "view": "" if n == 1 else "wide", "fixed": n == 1, "planned_by": "scene planning", "setting": "Elegant living room with terracotta painted walls and limestone floor.", "light": "Soft afternoon natural light.", "camera": "Wide angle from a front-left corner, capturing the room’s details.", "presentation": "Sofa in the center, loveseat to the right.", "supporting_props": props, "change": ""}
PLAN = {"run_id": "va6-2026-10-14T11-53-15-203Z", "product": "Sofas / Sofa Sets", "product_file": "11-QB-G-813-A.jpg", "outcome": "Lifestyle", "vendor_file": "W3, set or selection", "concept": False, "inventory": ["1 x sofa", "1 x loveseat", "2 x armchair"], "sided_parts": [], "shown_with": ["decorative throw pillows"], "count_notes": [], "provisional": [], "lead": "product", "midas_left_out_by_the_stylist": [], "midas_pieces": [], "shots": [shot(1, "catalogue", "1:1", []), shot(2, "lifestyle", "16:9", ["potted palm"]), shot(3, "lifestyle", "16:9", ["candle"])], "variations": None, "look_image": None, "scene_wishes": "", "styling_amount": "", "given_in_brief": {"sku": "", "dimensions": [], "note": "Recorded as given."}, "text_language": "en", "on_hold": [], "image_model": "the image model", "stops": "This go covers the white catalogue master. The run stops again and asks for a second go before the other 2 image(s).", "resolution": "2K", "delivery": "1125 x 1125", "paid_calls": {"already_made": {"eye": 1}, "to_come": {"image_renders": {"at_least": 3, "at_most": 6}}, "note": "Counts."}, "contract": {"brief_version": 1, "version": 1, "stamp": "sha256:x", "conflicts": [], "conflicts_unclassified": [], "unknowns": ["back sides of all seating pieces", "exact dimensions"], "modes": [], "midas_pieces_rejected": []}}
WAITING = {"found": True, "state": "awaiting_go", "run_id": PLAN["run_id"], "plan": PLAN, "summary": "3 image(s) planned, at most 6 with repairs.", "product_file": "11-QB-G-813-A.jpg", "asked_at": "2026-10-14T11:53:33.197Z", "answered_at": ""}
def studio(route):
    r = route.request; cors = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Content-Type": "application/json"}
    if r.method == "OPTIONS": return route.fulfill(status=204, headers=cors)
    if "status" in r.url:
        return route.fulfill(status=200, headers=cors, body=json.dumps({"found": False, "state": "not_finished"} if "key-check-" in r.url else WAITING))
    return route.fulfill(status=200, headers=cors, body=json.dumps({"message": "Workflow was started"}))
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1280, "height": 900}); page = ctx.new_page()
    errs = []; page.on("pageerror", lambda e: errs.append("pageerror: " + str(e))); page.on("console", lambda m: errs.append(m.type + ": " + m.text) if m.type in ("error", "warning") else None)
    page.route(STUDIO + "**", studio)
    page.goto(LIVE + "#studio")
    page.fill("#access-code", "studio-test-value"); page.click("#signin-submit"); page.wait_for_selector("#view-app:not([hidden])")
    page.set_input_files("#photo", "/home/claude/claude-midas-studio-site-a6-go/site/atelier-hero.webp"); page.click("#submit-btn")
    try:
        page.wait_for_selector("#owner-go:not([hidden])", timeout=70000); print("FRESH SUBMIT: panel shown")
    except Exception: print("FRESH SUBMIT: panel NOT shown")
    page.reload(); page.goto(LIVE + "#studio")
    page.fill("#access-code", "studio-test-value"); page.click("#signin-submit"); page.wait_for_selector("#view-app:not([hidden])")
    try:
        page.wait_for_selector("#owner-go:not([hidden])", timeout=20000); print("AFTER RELOAD: panel shown")
    except Exception: print("AFTER RELOAD: panel NOT shown")
    print("progress visible:", page.is_visible("#view-progress"), "| owner-go in DOM:", page.locator("#owner-go").count(), "| hidden:", page.evaluate("()=>{const n=document.getElementById('owner-go');return n?n.hidden:'missing'}"))
    page.screenshot(path="/home/claude/claude-midas-studio-site-a6-go/shots/claude-live-reload.png")
    print("errors:", [e for e in errs if "fonts" not in e][:10])
    b.close()
