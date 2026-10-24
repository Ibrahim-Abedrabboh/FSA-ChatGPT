"""A mocked A7 service for end-to-end tests of whole runs, with no paid or outside call.

The real flows run inside the service. Every outside call is answered by `Outside`. Up to Go 1 it answers with what the
outside services answered in the real run 1591 (the Netlify budget site, OpenAI for the stylist, Anthropic for the plan
critic). Run 1591 ends at Go 1, so past it the answers are made up (stand-ins): a budget permit and settlement for every
other paid step, an image for each image call, a passing blind count and a passing review, and an in-stock Midas page for
each planned piece. With them a run reaches Go 2, the package and a scene. A test can replace any answer to make a run hold,
refuse or throw. A call nobody answers fails the test when the service stops (the engine itself turns it into a hold, so it
would otherwise pass unseen).
Built for the Phase 1 items (claude-outputs/claude-midas-a7-phase-1-design-2026-10-22.md).
"""

from __future__ import annotations

import base64
import gzip
import io
import json
import uuid
from collections.abc import Callable
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFilter

from midas_a7.app import create_app
from midas_a7.config import Settings
from midas_a7.engine.executor import Executor, NodeError

FIXTURE = Path(__file__).parent / "fixtures" / "a7-run-1591-to-go1.json.gz"
RUNS_TABLE = "l0roUCBwIQL3h9Eq"
BRIDGE = "bridge-secret-for-tests"
CLIENT = "client-secret-for-tests"
NETLIFY = "midas-a7-owner-preview.netlify.app"
SECRETS = {"A7_BRIDGE_HEADER_VALUE": BRIDGE, "MIDAS_CLIENT_HEADER_VALUE": CLIENT, "MIDAS_OWNER_HEADER_VALUE": "owner-secret-for-tests",
           "PUBLIC_BASE_URL": "https://a7.test", "RESUME_SIGNING_SECRET": "resume-secret-for-tests", "OPENAI_API_KEY": "test",
           "ANTHROPIC_API_KEY": "test", "GEMINI_API_KEY": "test"}

Answer = Callable[[httpx.Request, dict], httpx.Response]
RECORDED_NODES = ("11 Stylist plans the scenes", "11c Plan critic")  # the paid steps run 1591 made before Go 1
SETTLED = {"recorded": True, "status": "completed", "accountedMicroUsd": 1000, "responsePreserved": True}
# The checks the review asks for (16a): the white master's, and a placed scene's.
WHITE_CHECKS = ("piece_count", "pieces_match", "shape", "colour", "material_texture", "details", "handedness", "not_mirrored",
                "nothing_added", "excluded_absent", "context_removed", "background", "contact_shadow", "whole_in_frame", "framing",
                "no_text_or_logo", "realism")
SCENE_CHECKS = ("piece_count", "pieces_match", "shape", "colour", "material_texture", "details", "handedness", "not_mirrored",
                "nothing_added", "excluded_absent", "only_listed_props", "midas_pieces_match", "people_ok", "no_unplanned_lamp", "scale",
                "grounding", "camera_level", "light", "no_text_or_logo", "realism")
MIDAS_PAGE = ('<html><body><h1>Midas piece</h1><div class="stock available"><span>In stock</span></div>'
              '<p>Product Size: W 120 x D 60 x H 45 cm</p><p>SKU: 100001</p></body></html>')


def stand_in_image(span: float = 0.76, size: int = 2048, sharp: bool = False) -> bytes:
    """A PNG on pure white with one light grey block (220) whose width spans `span` of the frame, measured at the middle of
    its blurred edge. The blur lets the package's grey-halo check (18h) pass at any span from 0.6 to 0.9; counted from the
    first non-white pixel it reads about 2.5 points wider. `sharp=True` gives a dark, hard-edged block, which leaves a halo
    in the saved webp, so the package holds."""
    im = Image.new("RGB", (size, size), (255, 255, 255))
    left = round(size * (1 - span) / 2)
    ImageDraw.Draw(im).rectangle([left, round(size * 0.3), size - left, round(size * 0.7)], fill=(120, 90, 60) if sharp else (220, 220, 220))
    if not sharp:
        im = im.filter(ImageFilter.GaussianBlur(24))
    out = io.BytesIO()
    im.save(out, "PNG")
    return out.getvalue()


def image_answer(png: bytes) -> httpx.Response:
    """A finished image interaction (what 15h and 15m read), with token counts so the cost is worked out."""
    return httpx.Response(200, json={
        "id": "stand-in-" + uuid.uuid4().hex[:12], "status": "completed",
        "steps": [{"type": "model_output", "content": [{"type": "image", "mime_type": "image/png", "data": base64.b64encode(png).decode()}]}],
        "usage": {"total_input_tokens": 1000, "total_output_tokens": 1290, "total_thought_tokens": 0,
                  "output_tokens_by_modality": [{"modality": "image", "tokens": 1290}]}})


def blind_count_answer(pieces: int = 3, box: tuple[int, int, int, int] = (300, 120, 700, 880), cropped: bool = False) -> httpx.Response:
    """The blind count (16x, a generateContent call): `pieces` product pieces in a box (ymin, xmin, ymax, xmax of 1000)."""
    reading = {"pieces": [{"kind": "piece", "count": pieces}], "total": pieces, "background_white": True, "text_or_logo": False,
               "unclear": [], "cropped": cropped, "hidden": [], "box_2d": list(box)}
    return httpx.Response(200, json={"candidates": [{"content": {"role": "model", "parts": [{"text": json.dumps(reading)}]}, "finishReason": "STOP"}],
                                     "usageMetadata": {"promptTokenCount": 1000, "candidatesTokenCount": 100}})


def review_answer(scene: bool, pieces: int = 3, share: int = 76, fail: dict[str, str] | None = None) -> httpx.Response:
    """The review (16, an Anthropic call): every check passes, except each `fail` check (key -> what is wrong)."""
    checks = {c: {"result": "pass", "evidence": "stand-in reading"} for c in (SCENE_CHECKS if scene else WHITE_CHECKS)}
    checks["piece_count"]["seen"] = pieces
    if "framing" in checks:
        checks["framing"]["share"] = share
    defects = []
    for c, what in (fail or {}).items():
        checks[c] = {"result": "fail", "evidence": what}
        defects.append({"check": c, "what": what, "where": "stand-in", "fix": "stand-in correction"})
    verdict = {"checks": checks, "defects": defects, "scores": {"fidelity": 95, "integrity": 95, "drift": 2, "data_loss": 2}, "summary": "stand-in"}
    return httpx.Response(200, json={"id": "msg_stand_in", "type": "message", "role": "assistant", "content": [{"type": "text", "text": json.dumps(verdict)}],
                                     "stop_reason": "end_turn", "usage": {"input_tokens": 1000, "output_tokens": 300}})


def recorded_run() -> dict:
    return json.loads(gzip.open(FIXTURE, "rt", encoding="utf-8").read())["runData"]


def recorded_output(recorded: dict, node: str) -> dict:
    return recorded[node][0]["main"][0][0]["json"]


def recorded_payload(recorded: dict) -> dict:
    return json.loads(recorded_output(recorded, "A7 job webhook")["body"]["payload"])


class Outside:
    """Answers the service's outside calls. `answers` maps a key to a function (request, json body) -> response.
    Keys: 'source-continuation', 'reserve', 'settle' (budget site paths); 'openai', 'anthropic' (hosts); 'image' and
    'blind-count' (the two Google calls, told apart by path); 'midas-page' (midasfurniture.com). Each call is recorded in
    `calls` as (host, path, budget node or None); a call nobody answers also goes to `unanswered`."""

    def __init__(self, recorded: dict):
        self.recorded = recorded
        self.calls: list[tuple[str, str, str | None]] = []
        self.unanswered: list[str] = []
        # A settle names the permit its reserve was given, so each settle gets the answer of its own stage.
        self.permits = {recorded_output(recorded, f"Budget · {s} · Reserve")["body"]["permit"]: s for s in ("11", "11c")}
        self.made_permits: dict[str, str] = {}  # stand-in permits for the paid steps after Go 1: permit -> budget node
        self.image = stand_in_image()  # what every image call returns; a test may change it between calls
        self.image_requests: list[dict] = []  # the body of each image call, in order
        self.answers: dict[str, Answer] = {
            "source-continuation": lambda r, b: httpx.Response(200, json=recorded_output(recorded, "Claim confirmed source continuation")["body"]),
            "reserve": self.reserve,
            "settle": self.settle,
            "openai": lambda r, b: httpx.Response(200, json=recorded_output(recorded, "11 Stylist plans the scenes")),
            "anthropic": self.anthropic,
            "image": self.image_call,
            "blind-count": lambda r, b: blind_count_answer(),
            "midas-page": lambda r, b: httpx.Response(200, text=MIDAS_PAGE, headers={"content-type": "text/html; charset=utf-8"}),
        }

    @staticmethod
    def stage(body: dict) -> str:
        """The run 1591 stage of a reserve, from the budget node it names."""
        node = body.get("node", "")
        if node not in RECORDED_NODES:
            raise AssertionError(f"no recorded reserve for {node!r}")
        return "11c" if node.startswith("11c") else "11"

    def reserve(self, request: httpx.Request, body: dict) -> httpx.Response:
        if body.get("node") in RECORDED_NODES:
            return httpx.Response(200, json=recorded_output(self.recorded, f"Budget · {self.stage(body)} · Reserve")["body"])
        permit = str(uuid.uuid4())
        self.made_permits[permit] = body.get("node", "")
        return httpx.Response(200, json={"send": True, "permit": permit, "reservedMicroUsd": 1_000_000, "pricingVersion": "stand-in"})

    def settle(self, request: httpx.Request, body: dict) -> httpx.Response:
        permit = body.get("permit")
        if permit in self.made_permits:
            return httpx.Response(200, json=SETTLED)
        return httpx.Response(200, json=recorded_output(self.recorded, f"Budget · {self.permits[permit]} · Settle")["body"])

    def image_call(self, request: httpx.Request, body: dict) -> httpx.Response:
        self.image_requests.append(body)
        return image_answer(self.image)

    def anthropic(self, request: httpx.Request, body: dict) -> httpx.Response:
        """The plan critic gets its run 1591 answer; the review of an image (an Anthropic call reserved as a stage 16 step)
        gets a passing review_answer, for a scene when the review asks for the scene checks."""
        if not any(node.startswith("16") for node in self.reserves()[-2:]):
            return httpx.Response(200, json=recorded_output(self.recorded, "11c Plan critic"))
        return review_answer(scene="only_listed_props" in json.dumps(body))

    def key(self, request: httpx.Request) -> str:
        host, path = request.url.host, request.url.path
        for name in ("source-continuation", "reserve", "settle"):
            if path.endswith("/api/a7/budget/" + name):
                return name
        if host == "generativelanguage.googleapis.com":
            return "blind-count" if path.endswith(":generateContent") else "image"
        return {"api.openai.com": "openai", "api.anthropic.com": "anthropic", "midasfurniture.com": "midas-page"}.get(host, host + path)

    def __call__(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content) if request.headers.get("content-type", "").startswith("application/json") else {}
        self.calls.append((request.url.host, request.url.path, body.get("node")))
        answer = self.answers.get(self.key(request))
        if answer is None:
            self.unanswered.append(f"{request.url.host}{request.url.path}")
            raise AssertionError(f"unexpected outside call {request.url.host}{request.url.path}")
        return answer(request, body)

    def paid(self) -> list[str]:
        """The provider calls made (each one would be paid in a real run)."""
        return [host for host, _, _ in self.calls if host.startswith(("api.", "generativelanguage."))]

    def image_calls(self) -> int:
        return sum(1 for host, path, _ in self.calls if host == "generativelanguage.googleapis.com" and not path.endswith(":generateContent"))

    def reserves(self) -> list[str]:
        """The budget node named by each reserve, in order."""
        return [node for _, path, node in self.calls if path.endswith("/api/a7/budget/reserve")]


class A7:
    """The running service plus helpers to send the recorded job, read its run row and decide at the gates."""

    def __init__(self, app, client: httpx.AsyncClient, outside: Outside):
        self.app, self.client, self.outside = app, client, outside
        self.store = app.state.services.store
        self.payload = recorded_payload(outside.recorded)

    async def drain(self) -> None:
        await self.app.state.runtime.drain()

    async def submit(self, photo: bytes | None = None, **changes) -> httpx.Response:
        """Send the recorded owner job through the bridge (with `changes` applied to its payload) and wait for the run.
        `photo` is the vendor photo (PNG bytes); by default a small grey one."""
        payload = {**self.payload, **changes}
        if photo is None:
            buf = io.BytesIO()
            Image.new("RGB", (64, 48), (200, 200, 200)).save(buf, "PNG")
            photo = buf.getvalue()
        name = payload["references"][0]["name"]
        r = await self.client.post("/webhook/a7/owner-submit", headers={"Authorization": BRIDGE}, data={"payload": json.dumps(payload)},
                                   files={"files0": (f"{name}.png", photo, "image/png")})
        await self.drain()
        return r

    def rows(self) -> list[dict]:
        return self.store.dt_select(RUNS_TABLE)

    def row(self) -> dict:
        [row] = self.rows()
        return row

    def executions(self) -> list[dict]:
        found, i = [], 1
        while (e := self.store.load_execution(str(i))) is not None:
            found.append(e)
            i += 1
        return found

    @staticmethod
    def fail_node(monkeypatch, name: str, message: str = "planted failure") -> None:
        """Make the node called `name` throw, as a Code node that throws does, whatever its input."""
        real = Executor._run_node

        async def run_node(self, flow, execution, node, inputs):
            if node.name == name:
                raise NodeError(message)
            return await real(self, flow, execution, node, inputs)
        monkeypatch.setattr(Executor, "_run_node", run_node)

    async def context(self) -> dict:
        r = await self.client.get(f"/webhook/a7/owner-context?id={self.payload['runId']}", headers={"Authorization": BRIDGE})
        return r.json()

    async def decide(self, decision: str, note: str = "test") -> httpx.Response:
        ctx = await self.context()
        r = await self.client.post("/webhook/a7/owner-decision", headers={"Authorization": BRIDGE}, json={
            "id": self.payload["clientRunId"], "run_id": self.payload["runId"], "round": ctx["round"], "decision": decision, "note": note})
        await self.drain()
        return r

    async def delivered(self, suffix: str) -> bytes:
        """The bytes of the delivered file whose label ends with `suffix` (read through its signed link, as the site does)."""
        [link] = [d["link"] for d in (await self.context())["deliveries"] if d["label"].endswith(suffix)]
        r = await self.client.get(link.removeprefix("https://a7.test"))
        assert r.status_code == 200
        return r.content

    async def to_go2(self) -> None:
        """Send the job, give Go 1, and stop at the white master's Go 2 (asserted)."""
        await self.submit()
        assert self.row()["status"] == "awaiting_go_1", self.row()["hold_reason"]
        await self.decide("go")
        assert self.row()["status"] == "awaiting_go_2", self.row()["hold_reason"]

    async def to_scene_go2(self) -> None:
        """As to_go2, then approve the white master: the package is made and the first scene stops at its own Go 2 (asserted)."""
        await self.to_go2()
        await self.decide("approve")
        row = self.row()
        assert row["status"] == "awaiting_go_2" and "scene" in (await self.context())["decisionNeeded"], row["hold_reason"]


@asynccontextmanager
async def a7_service(monkeypatch, recorded: dict | None = None):
    """Start the service with every outside call answered by an `Outside`; yields an `A7`. Fails if any outside call was
    left unanswered."""
    for k, v in SECRETS.items():
        monkeypatch.setenv(k, v)
    outside = Outside(recorded or recorded_run())
    app = create_app(Settings(database_url="sqlite://"))
    async with app.router.lifespan_context(app):
        app.state.services.http = httpx.AsyncClient(transport=httpx.MockTransport(outside))
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://a7.test") as client:
            yield A7(app, client, outside)
    assert not outside.unanswered, f"outside calls nobody answered: {outside.unanswered}"
