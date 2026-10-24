"""Checks for the owner Go / Stop panel. Mock mode, plus one run with simulated studio replies
(every request to the studio address is answered inside the browser; nothing leaves it).
Run: python3 -I tests/test_owner_go.py site <screenshot folder>
The keys below are made-up test strings, not real keys."""
import sys, json, threading, functools, http.server, socketserver, pathlib
from playwright.sync_api import sync_playwright

SRC = pathlib.Path(sys.argv[1]).resolve()
SHOTS = pathlib.Path(sys.argv[2]).resolve(); SHOTS.mkdir(parents=True, exist_ok=True)
STUDIO_KEY = 'studio-test-value-0001'
OWNER_KEY = 'owner-test-value-0002'
STUDIO_HOST = 'https://ibrahimnewaeon.app.n8n.cloud/'
FONT_HOSTS = ('https://fonts.googleapis.com/', 'https://fonts.gstatic.com/')
is_font = lambda url: url.startswith(FONT_HOSTS)   # the page's web fonts: blocked here, allowed by its own policy
INTERNAL = ['n8n', 'fal.ai', 'flux', 'nano banana', 'gpt', 'openai', 'webhook', 'stylist', 'the eye', 'critic', 'brain']

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(SRC))
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
server = socketserver.TCPServer(('127.0.0.1', 0), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_address[1]}/index.html'

results = []
def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail and not ok else ''))

def new_page(browser, query, width=1280, height=900):
    ctx = browser.new_context(viewport={'width': width, 'height': height})
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'ERR_FAILED' not in m.text else None)   # ERR_FAILED: the fonts this test blocks
    escaped = []
    page.route('**/*', lambda route: route.continue_() if route.request.url.startswith('http://127.0.0.1') else (None if is_font(route.request.url) else escaped.append(route.request.url), route.abort()))
    page.goto(BASE + query + '#studio')
    return ctx, page, errors, escaped

def submit_request(page):
    page.set_input_files('#photo', str(SRC / 'atelier-hero.webp'))
    page.click('#submit-btn')
    page.wait_for_selector('#view-progress:not([hidden])', timeout=8000)

def mock(page, key):
    return page.evaluate(f'() => window.MIDAS_STUDIO_MOCK.{key}')

def panel_visible(page):
    return page.evaluate("() => !document.getElementById('owner-go').hidden")

def open_panel(page):
    page.wait_for_selector('#owner-go:not([hidden])', timeout=15000)
    if not page.evaluate("() => document.getElementById('owner-go').open"):
        page.click('#owner-go > summary')

def storage_dump(page):
    return page.evaluate("() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)])")

def internal_terms(text):
    low = text.lower()
    return [w for w in INTERNAL if w in low]

with sync_playwright() as p:
    browser = p.chromium.launch()

    # 1. Two goes: plan first, then the white catalogue image, then results.
    ctx, page, errors, escaped = new_page(browser, '?mock=1&result=waitgo2')
    check('mock bar has the Owner go select', page.is_visible('#mock-decision'))
    submit_request(page)
    check('panel hidden before the request waits', not panel_visible(page))
    open_panel(page)
    plan_text = page.inner_text('#owner-go')
    check('first stop shows the plan title', 'First go: the plan' in plan_text, plan_text[:200])
    check('first stop shows the piece count read from the photo', '2 x sofa; 2 x armchair' in plan_text)
    check('first stop lists each image with role and frame', 'Image 2 · lifestyle scene · landscape 16:9' in plan_text and 'Image 1 · catalogue on white · square' in plan_text)
    check('first stop says the run stops again', 'stops again' in plan_text)
    check('no internal terms in the panel', not internal_terms(plan_text), str(internal_terms(plan_text)))
    page.screenshot(path=str(SHOTS / 'claude-owner-go-1-plan.png'), full_page=False)
    page.locator('#owner-go').screenshot(path=str(SHOTS / 'claude-owner-go-1-plan-panel.png'))
    page.click('#owner-go-btn')
    check('go without a key is not sent', mock(page, 'lastDecision') is None and 'Enter the owner key' in page.inner_text('#owner-go-message'))
    page.fill('#owner-key', OWNER_KEY)
    page.press('#owner-key', 'Enter')
    page.wait_for_timeout(500)
    check('Enter in the key field sends nothing', mock(page, 'lastDecision') is None)
    page.fill('#owner-note', 'Test note')
    page.click('#owner-go-btn')
    page.wait_for_function("() => !document.getElementById('owner-go-message').hidden && /Go recorded/.test(document.getElementById('owner-go-message').textContent)", timeout=5000)
    last = mock(page, 'lastDecision')
    check('first go sent with id, decision and note', last and last['decision'] == 'go' and last['note'] == 'Test note' and last['keySent'] and last['id'] == page.inner_text('#view-progress code[data-bind="reference"]'), json.dumps(last))
    check('key field cleared after sending', page.input_value('#owner-key') == '')
    check('key not in local or session storage', OWNER_KEY not in storage_dump(page))
    page.wait_for_function("() => document.getElementById('owner-go').hidden", timeout=8000)
    check('panel hides while the images are being made', not panel_visible(page))
    open_panel(page)
    master_text = page.inner_text('#owner-go')
    check('second stop shows the white image title', 'Second go: the white catalogue image' in master_text, master_text[:200])
    check('second stop labels the image Generated image', 'generated image' in master_text.lower() and page.locator('#owner-go-plan img').count() == 1)
    check('second stop says reviewed candidate, not approval', 'reviewed candidate, not an approval' in master_text)
    check('form shown again at the second stop', page.is_visible('#owner-go-form'))
    page.locator('#owner-go').screenshot(path=str(SHOTS / 'claude-owner-go-2-white-image-panel.png'))
    page.fill('#owner-key', OWNER_KEY)
    page.click('#owner-go-btn')
    page.wait_for_selector('#view-results:not([hidden])', timeout=15000)
    check('after the second go the results show', page.is_visible('#view-results'))
    check('panel gone with the results', not panel_visible(page))
    check('no page errors (two goes)', not errors, '; '.join(errors))
    check('no request left the browser (two goes)', not escaped, '; '.join(escaped))
    ctx.close()

    # 2. Stop needs a second press, then the request ends.
    ctx, page, errors, escaped = new_page(browser, '?mock=1&result=waitgo')
    submit_request(page)
    open_panel(page)
    check('one-go request: no second-stop sentence', 'stops again' not in page.inner_text('#owner-go'))
    page.fill('#owner-key', OWNER_KEY)
    page.click('#owner-stop-btn')
    check('first press of Stop sends nothing', mock(page, 'lastDecision') is None and page.inner_text('#owner-stop-btn') == 'Press again to stop')
    page.click('#owner-stop-btn')
    page.wait_for_function("() => /Stop recorded/.test(document.getElementById('owner-go-message').textContent)", timeout=5000)
    check('second press sends the stop', (mock(page, 'lastDecision') or {}).get('decision') == 'stop')
    page.wait_for_function("() => /stopped before any image/.test(document.getElementById('progress-message-text').textContent)", timeout=8000)
    check('page shows the request as stopped', True)
    check('no page errors (stop)', not errors, '; '.join(errors))
    ctx.close()

    # 3. Answers that record nothing: key refused, problem, network.
    for setting, expect in [('denied', 'The owner key was refused'), ('problem', 'Not recorded: No run is waiting'), ('network', 'could not be reached')]:
        ctx, page, errors, escaped = new_page(browser, f'?mock=1&result=waitgo&decision={setting}')
        submit_request(page)
        open_panel(page)
        page.fill('#owner-key', OWNER_KEY)
        page.click('#owner-go-btn')
        page.wait_for_function("() => !document.getElementById('owner-go-message').hidden", timeout=5000)
        msg = page.inner_text('#owner-go-message')
        check(f'{setting}: clear message', expect in msg, msg)
        check(f'{setting}: form stays for another try', page.is_visible('#owner-go-form') and page.input_value('#owner-key') == '')
        check(f'{setting}: the studio key session is kept', page.is_visible('#view-app'))
        ctx.close()

    # 4. No regression: a request that does not wait never shows the panel.
    ctx, page, errors, escaped = new_page(browser, '?mock=1&result=passed')
    submit_request(page)
    page.wait_for_selector('#view-results:not([hidden])', timeout=15000)
    check('normal request: results without a panel', not panel_visible(page))
    check('no page errors (normal)', not errors, '; '.join(errors))
    ctx.close()

    # 5. Phone width: nothing wider than the screen.
    ctx, page, errors, escaped = new_page(browser, '?mock=1&result=waitgo2', width=380, height=800)
    submit_request(page)
    open_panel(page)
    over = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check('phone width: no sideways scroll', over <= 0, f'{over}px')
    page.locator('#owner-go').screenshot(path=str(SHOTS / 'claude-owner-go-3-phone.png'))
    ctx.close()

    # 6. Simulated studio replies (not mock mode): which key goes where.
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900})
    page = ctx.new_page()
    seen = []
    state = {'decided': False}
    def studio(route):
        req = route.request
        url = req.url
        headers = req.headers
        if req.method == 'OPTIONS':
            return route.fulfill(status=204, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'})
        seen.append({'url': url.split('?')[0], 'method': req.method, 'key': headers.get('x-midas-key', ''), 'body': req.post_data if 'decision' in url else ''})
        cors = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
        if 'claude-midas-vton-a6-decision' in url:
            state['decided'] = True
            return route.fulfill(status=200, headers=cors, body=json.dumps({'saved': True, 'decision': 'go', 'decided_at': '2026-10-14T11:40:00.000Z'}))
        if 'claude-midas-vton-a6-status' in url:
            if 'key-check-' in url:
                return route.fulfill(status=200, headers=cors, body=json.dumps({'found': False, 'state': 'not_finished'}))
            if state['decided']:
                return route.fulfill(status=200, headers=cors, body=json.dumps({'found': True, 'state': 'started', 'run_id': 'va6-sim'}))
            return route.fulfill(status=200, headers=cors, body=json.dumps({'found': True, 'state': 'awaiting_go', 'run_id': 'va6-sim', 'summary': '3 image(s) planned.', 'asked_at': '2026-10-14T11:16:31.862Z', 'plan': {'product': 'Sofas / Sofa Sets', 'inventory': ['2 x sofa', '2 x armchair'], 'shots': []}}))
        if url.rstrip('/').endswith('claude-midas-vton-a6'):
            return route.fulfill(status=200, headers=cors, body=json.dumps({'message': 'Workflow was started'}))
        return route.fulfill(status=404, headers=cors, body='{}')
    escaped = []
    page.route(STUDIO_HOST + '**', studio)
    page.route('**/*', lambda route: route.fallback() if route.request.url.startswith(STUDIO_HOST) else (route.continue_() if route.request.url.startswith('http://127.0.0.1') else (None if is_font(route.request.url) else escaped.append(route.request.url), route.abort())))
    page.goto(BASE + '#studio')
    page.fill('#access-code', STUDIO_KEY)
    page.click('#signin-submit')
    page.wait_for_selector('#view-app:not([hidden])', timeout=8000)
    page.set_input_files('#photo', str(SRC / 'atelier-hero.webp'))
    page.click('#submit-btn')
    page.wait_for_selector('#owner-go:not([hidden])', timeout=60000)
    page.click('#owner-go > summary')
    page.fill('#owner-key', OWNER_KEY)
    page.click('#owner-go-btn')
    page.wait_for_function("() => /Go recorded/.test(document.getElementById('owner-go-message').textContent)", timeout=8000)
    decision_calls = [s for s in seen if 'decision' in s['url']]
    other_calls = [s for s in seen if 'decision' not in s['url']]
    check('simulated: exactly one go sent', len(decision_calls) == 1, json.dumps(decision_calls))
    d = decision_calls[0] if decision_calls else {}
    check('simulated: the go carries the owner key', d.get('key') == OWNER_KEY)
    check('simulated: the go never carries the studio key', d.get('key') != STUDIO_KEY)
    body = json.loads(d.get('body') or '{}')
    ref = page.inner_text('#view-progress code[data-bind="reference"]')
    check('simulated: body is the job id and "go"', body == {'id': ref, 'decision': 'go'}, json.dumps(body))
    check('simulated: other calls keep the studio key', other_calls and all(s['key'] == STUDIO_KEY for s in other_calls))
    check('simulated: owner key not stored', OWNER_KEY not in storage_dump(page))
    check('simulated: nothing left the browser', not escaped, '; '.join(escaped))
    ctx.close()
    browser.close()

server.shutdown()
failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)}/{len(results)} checks passed')
(SHOTS / 'claude-owner-go-test-results.json').write_text(json.dumps([{'check': n, 'passed': ok, 'detail': d} for n, ok, d in results], indent=1))
sys.exit(1 if failed else 0)
