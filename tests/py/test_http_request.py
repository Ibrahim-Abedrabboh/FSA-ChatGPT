"""HTTP Request node: output shapes, credentials, bodies, files, errors, batching and in-process routing."""

from __future__ import annotations

import asyncio
import copy
import importlib
import json
from email import policy
from email.parser import BytesParser

import httpx
import pytest
from conftest import link, make_flow, run_flow

from midas_a7.nodes.http_request import (RequestFailure, api_error_fields, js_stringify)

BUDGET_URL = "https://midas-a7-owner-preview.netlify.app/api/a7/budget/reserve"
BRIDGE_CRED = {"httpHeaderAuth": {"id": "S6DlmKQiz2USSkNE", "name": "A7 GPT bridge inbound"}}
NEVER_ERROR_JSON = {"redirect": {"redirect": {"followRedirects": False}},
                    "response": {"response": {"fullResponse": True, "neverError": True, "responseFormat": "json"}},
                    "timeout": 20000}


def start():
    return {"name": "Start", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [0, 0], "parameters": {}}


def http_node(params, version=4.2, **extra):
    return {"name": "HTTP", "type": "n8n-nodes-base.httpRequest", "typeVersion": version, "position": [200, 0],
            "parameters": params, **extra}


async def run_http(executor, params, items=None, version=4.2, **extra):
    flow = make_flow([start(), http_node(params, version, **extra)], link(("Start", "HTTP")))
    return await run_flow(executor, flow, items or [{"json": {}}])


@pytest.fixture
async def mock_http(services):
    """Replace the outside client by one that answers from `mock_http.handler`; records every request."""
    class Mock:
        requests: list[httpx.Request]
        handler = staticmethod(lambda request: httpx.Response(200, json={}))
    mock = Mock()
    mock.requests = []

    def dispatch(request: httpx.Request) -> httpx.Response:
        mock.requests.append(request)
        return mock.handler(request)

    old = services.http
    services.http = httpx.AsyncClient(transport=httpx.MockTransport(dispatch))
    yield mock
    await services.http.aclose()
    services.http = old


# ---------- json, fullResponse, neverError, header credential ----------
@pytest.mark.parametrize("status,phrase", [(200, "OK"), (409, "Conflict"), (500, "Internal Server Error")])
async def test_json_full_response_never_error(executor, mock_http, monkeypatch, status, phrase):
    monkeypatch.setenv("A7_BRIDGE_HEADER_VALUE", "bridge-secret")
    mock_http.handler = lambda r: httpx.Response(status, json={"send": status == 200, "permit": "p-1"},
                                                 headers={"Cache-Control": "no-store", "X-Thing": "a"})
    params = {"method": "POST", "url": BUDGET_URL, "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
              "sendBody": True, "specifyBody": "json", "jsonBody": "={{ $json.budgetRequest }}", "options": NEVER_ERROR_JSON}
    ex = await run_http(executor, params, [{"json": {"budgetRequest": {"op": "reserve", "usd": 1.0, "name": "é", "n": [1, 2.5]}}}],
                        credentials=BRIDGE_CRED)
    assert ex.status == "success", ex.error
    [item] = ex.latest_output("HTTP")
    out = item["json"]
    assert list(out) == ["body", "headers", "statusCode", "statusMessage"]
    assert out["body"] == {"send": status == 200, "permit": "p-1"}
    assert out["statusCode"] == status and isinstance(out["statusCode"], int)
    assert out["statusMessage"] == phrase
    assert out["headers"]["cache-control"] == "no-store" and out["headers"]["x-thing"] == "a"
    assert all(k == k.lower() for k in out["headers"])
    [req] = mock_http.requests
    assert req.method == "POST" and str(req.url) == BUDGET_URL
    assert req.content == '{"op":"reserve","usd":1,"name":"é","n":[1,2.5]}'.encode()  # JSON.stringify, not json.dumps
    assert req.headers["content-type"] == "application/json" and req.headers["accept"] == "application/json,text/*;q=0.99"
    assert req.headers["authorization"] == "bridge-secret"  # header name/value from the credential settings
    assert req.headers["user-agent"].startswith("axios/")


async def test_recorded_budget_answer_shape(executor, mock_http, monkeypatch):
    """Shape of 'Budget · 11 · Reserve' in n8n execution 1591 (harmless fields only)."""
    monkeypatch.setenv("A7_BRIDGE_HEADER_VALUE", "x")
    recorded_body = {"send": True, "permit": "52aaec43-f2eb-46bb-a596-7e5a09d7344e", "reservedMicroUsd": 4320000,
                     "pricingVersion": "a7-standard-2026-10-17"}
    mock_http.handler = lambda r: httpx.Response(200, json=recorded_body, headers={"cache-control": "no-store", "server": "Netlify"})
    params = {"method": "POST", "url": BUDGET_URL, "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
              "sendBody": True, "specifyBody": "json", "jsonBody": "={{ $json }}", "options": NEVER_ERROR_JSON}
    ex = await run_http(executor, params, credentials=BRIDGE_CRED)
    out = ex.latest_output("HTTP")[0]["json"]
    assert out["body"] == recorded_body and out["statusCode"] == 200 and out["statusMessage"] == "OK"
    assert out["headers"]["server"] == "Netlify"


async def test_header_credentials_use_configured_name_and_value(executor, mock_http, monkeypatch):
    monkeypatch.setenv("MIDAS_CLIENT_HEADER_VALUE", "client-secret")
    monkeypatch.setenv("MIDAS_OWNER_HEADER_VALUE", "owner-secret")
    params = {"method": "POST", "url": "https://example.test/x", "authentication": "genericCredentialType",
              "genericAuthType": "httpHeaderAuth", "sendBody": True, "specifyBody": "json", "jsonBody": "{}"}
    await run_http(executor, params, credentials={"httpHeaderAuth": {"id": "1", "name": "Claude · Midas client header"}})
    await run_http(executor, params, credentials={"httpHeaderAuth": {"id": "2", "name": "Claude · Midas owner header"}})
    assert mock_http.requests[0].headers["x-midas-key"] == "client-secret"
    assert mock_http.requests[1].headers["x-midas-owner-key"] == "owner-secret"


async def test_missing_credential_fails_the_node_without_a_request(executor, mock_http, monkeypatch):
    monkeypatch.delenv("A7_BRIDGE_HEADER_VALUE", raising=False)
    params = {"method": "POST", "url": BUDGET_URL, "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
              "sendBody": True, "specifyBody": "json", "jsonBody": "{}"}
    ex = await run_http(executor, params, credentials=BRIDGE_CRED)
    assert ex.status == "error" and "A7_BRIDGE_HEADER_VALUE" in ex.error["message"]
    assert mock_http.requests == []


# ---------- OpenAI and Google credentials ----------
async def test_openai_bearer_and_gemini_key_query(executor, mock_http, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("GEMINI_API_KEY", "AIzaTest")
    openai = {"method": "POST", "url": "https://api.openai.com/v1/responses", "authentication": "predefinedCredentialType",
              "nodeCredentialType": "openAiApi", "sendBody": True, "specifyBody": "json", "jsonBody": "={{ $json.body }}",
              "options": NEVER_ERROR_JSON}
    await run_http(executor, openai, [{"json": {"body": {"model": "m", "input": "hi"}}}], version=4.5)
    gemini_get = {"url": "https://generativelanguage.googleapis.com/v1beta/interactions/abc?alt=json",
                  "authentication": "predefinedCredentialType", "nodeCredentialType": "googlePalmApi",
                  "options": {"response": {"response": {"fullResponse": True, "neverError": True, "responseFormat": "json"}}, "timeout": 60000}}
    await run_http(executor, gemini_get)
    first, second = mock_http.requests
    assert first.headers["authorization"] == "Bearer sk-test" and "openai-organization" not in first.headers
    assert json.loads(first.content) == {"model": "m", "input": "hi"}
    assert second.method == "GET" and second.content == b"" and "authorization" not in second.headers
    assert str(second.url) == "https://generativelanguage.googleapis.com/v1beta/interactions/abc?alt=json&key=AIzaTest"


async def test_error_item_never_carries_the_key(executor, mock_http, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "AIzaSECRET")
    mock_http.handler = lambda r: (_ for _ in ()).throw(httpx.ReadTimeout("slow"))
    params = {"url": "https://generativelanguage.googleapis.com/v1beta/interactions", "authentication": "predefinedCredentialType",
              "nodeCredentialType": "googlePalmApi", "options": {"timeout": 60000}}
    ex = await run_http(executor, params, onError="continueRegularOutput")
    assert "AIzaSECRET" not in json.dumps(ex.latest_output("HTTP"))


# ---------- other body kinds, headers, query ----------
async def test_keypair_body_headers_and_query(executor, mock_http):
    params = {"method": "POST", "url": "https://example.test/p?x=1", "sendQuery": True,
              "queryParameters": {"parameters": [{"name": "a b", "value": "c&d"}, {"name": "n", "value": 5}]},
              "sendHeaders": True, "headerParameters": {"parameters": [{"name": "X-Custom", "value": "v"}, {"name": "", "value": "skip"}]},
              "sendBody": True, "bodyParameters": {"parameters": [{"name": "a.b", "value": "1"}, {"name": "list[0]", "value": True}]}}
    await run_http(executor, params)
    [req] = mock_http.requests
    assert str(req.url) == "https://example.test/p?x=1&a%20b=c%26d&n=5"
    assert req.headers["x-custom"] == "v"
    assert json.loads(req.content) == {"a": {"b": "1"}, "list": [True]}
    assert req.headers["content-type"] == "application/json"


async def test_form_urlencoded_raw_and_binary_bodies(executor, mock_http, services):
    form = {"method": "POST", "url": "https://example.test/f", "sendBody": True, "contentType": "form-urlencoded",
            "specifyBody": "keypair", "bodyParameters": {"parameters": [{"name": "k", "value": "a b"}, {"name": "z", "value": "é"}]}}
    raw = {"method": "POST", "url": "https://example.test/r", "sendBody": True, "contentType": "raw", "rawContentType": "text/xml",
           "body": "<a/>"}
    ref = await services.binaries.put("1", b"BYTES", "application/x-thing", "t.bin")
    binary = {"method": "PUT", "url": "https://example.test/b", "sendBody": True, "contentType": "binaryData", "inputDataFieldName": "file"}
    await run_http(executor, form)
    await run_http(executor, raw)
    await run_http(executor, binary, [{"json": {}, "binary": {"file": ref}}])
    f, r, b = mock_http.requests
    assert f.content == b"k=a%20b&z=%C3%A9" and f.headers["content-type"] == "application/x-www-form-urlencoded"
    assert r.content == b"<a/>" and r.headers["content-type"] == "text/xml"
    assert b.method == "PUT" and b.content == b"BYTES" and b.headers["content-type"] == "application/x-thing"


async def test_invalid_json_body_and_bad_urls(executor, mock_http):
    bad_json = {"method": "POST", "url": "https://example.test/x", "sendBody": True, "specifyBody": "json", "jsonBody": "{nope"}
    ex = await run_http(executor, bad_json)
    assert ex.status == "error" and ex.error["message"] == 'The value in the "JSON Body" field is not valid JSON'
    ex = await run_http(executor, {"url": "ftp://example.test"})
    assert ex.error["message"] == 'Invalid URL: ftp://example.test. URL must start with "http" or "https".'
    ex = await run_http(executor, {"url": "={{ $json.missing }}"})
    assert "URL parameter must be a string" in ex.error["message"]
    assert mock_http.requests == []


# ---------- multipart with binary files ----------
def parse_multipart(request: httpx.Request):
    head = b"Content-Type: " + request.headers["content-type"].encode() + b"\r\n\r\n"
    message = BytesParser(policy=policy.default).parsebytes(head + request.content)
    return [(p.get_param("name", header="content-disposition"), p.get_filename(), p.get_content_type(), p.get_payload(decode=True))
            for p in message.iter_parts()]


def multipart_params(version, count=4):
    fields = [{"parameterType": "formData", "name": "payload", "value": "={{ $json.payload }}"}]
    fields += [{"parameterType": "formBinaryData", "name": f"files{i}", "inputDataFieldName": f'={{{{ $json.uploadFields[{i}] || "" }}}}'}
               for i in range(count)]
    return {"method": "POST", "url": "https://example.test/webhook/claude-midas-a7-analysis",
            "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth", "sendBody": True,
            "contentType": "multipart-form-data", "bodyParameters": {"parameters": fields},
            "options": {"timeout": 295000, "redirect": {"redirect": {"followRedirects": False}},
                        "response": {"response": {"fullResponse": True, "neverError": True}}}}


@pytest.mark.parametrize("version", [4.1, 4.2])
async def test_multipart_form_with_binaries(executor, services, mock_http, monkeypatch, version):
    monkeypatch.setenv("MIDAS_CLIENT_HEADER_VALUE", "client-secret")
    png = b"\x89PNG\r\n\x1a\n" + bytes(range(256))
    jpg = b"\xff\xd8\xff\xe0JFIF"
    ref_a = await services.binaries.put("1", png, "image/png", "room.png")
    ref_b = await services.binaries.put("1", jpg, "image/jpeg", "dir/photo.jpg")
    item = {"json": {"payload": '{"clientRunId":"x","é":1}', "uploadFields": ["up_a", "up_b"]}, "binary": {"up_a": ref_a, "up_b": ref_b}}
    mock_http.handler = lambda r: httpx.Response(200, json={"ok": True, "status": "received"})
    ex = await run_http(executor, multipart_params(version), [item], version=version,
                        credentials={"httpHeaderAuth": {"id": "1", "name": "Claude · Midas client header"}})
    assert ex.status == "success", ex.error
    [req] = mock_http.requests
    assert req.headers["content-type"].startswith("multipart/form-data; boundary=--------------------------")
    assert req.headers["x-midas-key"] == "client-secret"
    assert parse_multipart(req) == [("payload", None, "text/plain", '{"clientRunId":"x","é":1}'.encode()),
                                    ("files0", "room.png", "image/png", png), ("files1", "photo.jpg", "image/jpeg", jpg)]
    out = ex.latest_output("HTTP")[0]["json"]
    assert out["statusCode"] == 200 and out["body"] == {"ok": True, "status": "received"}  # autodetect parses a JSON answer


async def test_multipart_missing_binary_is_an_item_error_when_continuing(executor, mock_http, monkeypatch):
    monkeypatch.setenv("MIDAS_CLIENT_HEADER_VALUE", "client-secret")
    items = [{"json": {"payload": "p", "uploadFields": ["nope"]}}, {"json": {"payload": "q", "uploadFields": []}}]
    ex = await run_http(executor, multipart_params(4.1, 1), items, version=4.1, onError="continueRegularOutput",
                        credentials={"httpHeaderAuth": {"id": "1", "name": "Claude · Midas client header"}})
    first, second = ex.latest_output("HTTP")
    assert first["json"] == {"error": "This operation expects the node's input data to contain a binary file 'nope', but none was found [item 0]"}
    assert second["json"]["statusCode"] == 200  # item 1 still went out (its empty binary field name is skipped)
    assert len(mock_http.requests) == 1


# ---------- file, text and autodetect answers ----------
async def test_file_response_becomes_binary(executor, services, mock_http):
    photo = b"\xff\xd8\xff\xe0" + b"x" * 60
    mock_http.handler = lambda r: httpx.Response(200, content=photo, headers={"content-type": "image/jpeg"})
    params = {"method": "GET", "url": "={{ $json.url }}", "options": {"redirect": {"redirect": {"followRedirects": False}},
              "response": {"response": {"responseFormat": "file", "outputPropertyName": "data"}}, "timeout": 30000}}
    other = await services.binaries.put("1", b"keep", "text/plain", "keep.txt")
    ex = await run_http(executor, params, [{"json": {"url": "https://midasfurniture.com/media/catalog/product/a/b/sofa.jpg?v=3", "sku": "S1"},
                                             "binary": {"other": other}}], version=4.5)
    [item] = ex.latest_output("HTTP")
    assert item["json"] == {"url": "https://midasfurniture.com/media/catalog/product/a/b/sofa.jpg?v=3", "sku": "S1"}
    ref = item["binary"]["data"]
    assert (ref["mimeType"], ref["fileName"], ref["fileExtension"], ref["fileType"], ref["bytes"]) == ("image/jpeg", "sofa.jpg", "jpg", "image", len(photo))
    assert await services.binaries.get(ref) == photo
    assert item["binary"]["other"] == other
    assert mock_http.requests[0].headers["accept"].startswith("application/json,text/html")


async def test_file_response_full_response_and_name_from_extension(executor, services, mock_http):
    mock_http.handler = lambda r: httpx.Response(200, content=b"%PDF-1.4 x", headers={"content-type": "application/pdf; charset=binary"})
    params = {"url": "https://example.test/download", "options": {"response": {"response": {
        "fullResponse": True, "responseFormat": "file", "outputPropertyName": "scene"}}}}
    ex = await run_http(executor, params, [{"json": {"keep": 1}}])
    [item] = ex.latest_output("HTTP")
    assert set(item["json"]) == {"headers", "statusCode", "statusMessage"} and item["json"]["statusCode"] == 200
    ref = item["binary"]["scene"]
    assert ref["fileName"] == "download" and ref["mimeType"] == "application/pdf" and ref["fileType"] == "pdf"


async def test_autodetect_picks_json_text_or_file(executor, services, mock_http):
    answers = {
        "/json": httpx.Response(200, json=[{"a": 1}, {"a": 2}]),
        "/object": httpx.Response(200, json={"a": 1}),
        "/html": httpx.Response(200, text="<p>héllo</p>", headers={"content-type": "text/html; charset=utf-8"}),
        "/img": httpx.Response(200, content=b"\x89PNG\r\n\x1a\nzz", headers={"content-type": "image/png"}),
        "/empty": httpx.Response(204),
    }
    mock_http.handler = lambda r: answers[r.url.path]
    outputs = {}
    for path in answers:
        ex = await run_http(executor, {"url": "https://example.test" + path})
        outputs[path] = ex.latest_output("HTTP")
    assert [i["json"] for i in outputs["/json"]] == [{"a": 1}, {"a": 2}]  # an array body: one item per element
    assert outputs["/object"] == [{"json": {"a": 1}}]
    assert outputs["/html"] == [{"json": {"data": "<p>héllo</p>"}}]
    assert outputs["/empty"] == [{"json": {}}]
    assert outputs["/img"][0]["binary"]["data"]["mimeType"] == "image/png"
    assert outputs["/img"][0]["json"] == {}


async def test_text_response_full_and_plain(executor, mock_http):
    html = "<html><body data-in-stock=\"1\">Toolbar</body></html>"
    mock_http.handler = lambda r: httpx.Response(404 if r.url.path == "/gone" else 200, text=html, headers={"content-type": "text/html"})
    full = {"method": "GET", "url": "https://midasfurniture.com/gone", "options": {"batching": {"batch": {"batchSize": 1, "batchInterval": 10000}},
            "response": {"response": {"fullResponse": True, "neverError": True, "responseFormat": "text"}}, "timeout": 60000}}
    ex = await run_http(executor, full, version=4.5)
    [item] = ex.latest_output("HTTP")
    assert list(item["json"]) == ["data", "headers", "statusCode", "statusMessage"]  # the text sits under outputPropertyName, not body
    assert item["json"]["data"] == html and item["json"]["statusCode"] == 404
    plain = {"url": "https://midasfurniture.com/ok", "options": {"response": {"response": {"responseFormat": "text", "outputPropertyName": "page"}}}}
    ex = await run_http(executor, plain)
    assert ex.latest_output("HTTP") == [{"json": {"page": html}}]


async def test_text_format_restringifies_json_like_axios_does(executor, mock_http):
    mock_http.handler = lambda r: httpx.Response(200, text='{ "a" : 1,\n "b": [1, 2] }', headers={"content-type": "text/plain"})
    ex = await run_http(executor, {"url": "https://example.test/t", "options": {"response": {"response": {"responseFormat": "text"}}}})
    assert ex.latest_output("HTTP") == [{"json": {"data": '{"a":1,"b":[1,2]}'}}]


async def test_json_format_with_text_body_is_an_error(executor, mock_http):
    mock_http.handler = lambda r: httpx.Response(200, text="<html>", headers={"content-type": "text/html"})
    params = {"url": "https://example.test/h", "options": {"response": {"response": {"responseFormat": "json"}}}}
    ex = await run_http(executor, params)
    assert ex.error["message"] == 'Response body is not valid JSON. Change "Response Format" to "Text"'
    ex = await run_http(executor, params, onError="continueRegularOutput")
    assert ex.latest_output("HTTP") == [{"json": {"error": 'Response body is not valid JSON. Change "Response Format" to "Text"'}}]


async def test_resume_request_posts_the_stringified_answer(executor, mock_http):
    """'G1c Resume the waiting run': body text from JSON.stringify, answer of any kind, node continues on error."""
    mock_http.handler = lambda r: httpx.Response(200, json={"resumed": True})
    params = {"method": "POST", "url": "={{ $json.resume_url }}", "sendBody": True, "specifyBody": "json",
              "jsonBody": "={{ JSON.stringify($json.answer) }}", "options": {"timeout": 30000}}
    ex = await run_http(executor, params, [{"json": {"resume_url": "https://a7.example/resume/1", "answer": {"id": "x", "n": 2}}}],
                        onError="continueRegularOutput", alwaysOutputData=True)
    assert ex.latest_output("HTTP") == [{"json": {"resumed": True}}]
    assert mock_http.requests[0].content == b'{"id":"x","n":2}'


# ---------- errors ----------
async def test_http_error_without_never_error_fails_with_n8n_message(executor, mock_http):
    mock_http.handler = lambda r: httpx.Response(404, json={"error": {"message": "no such photo"}})
    params = {"url": "https://example.test/missing", "options": {"response": {"response": {"responseFormat": "json"}}}}
    ex = await run_http(executor, params)
    assert ex.status == "error"
    assert ex.error["message"] == "The resource you are requesting could not be found"
    assert ex.error["description"] == "no such photo"


async def test_http_error_item_when_continuing(executor, mock_http, caplog):
    mock_http.handler = lambda r: httpx.Response(500, text="boom", headers={"content-type": "text/plain"})
    params = {"url": "https://example.test/x?token=1", "options": {}}
    ex = await run_http(executor, params, version=4.5, onError="continueRegularOutput")
    assert "HTTP: item 0 failed: The service was not able to process your request [500]: boom" in caplog.text
    assert "token=1" not in caplog.text  # the log line never carries the request
    [item] = ex.latest_output("HTTP")
    error = item["json"]["error"]
    assert error["message"] == '500 - "boom"' and error["status"] == 500 and error["name"] == "AxiosError"
    assert error["error"] == "boom" and error["response"]["statusText"] == "Internal Server Error"
    assert item["json"]["details"] == {"message": "The service was not able to process your request", "description": "boom",
                                       "httpCode": "500", "body": "boom", "context": {"itemIndex": 0}}
    # typeVersion 4.2 has no `details`
    ex = await run_http(executor, params, version=4.2, onError="continueRegularOutput")
    assert "details" not in ex.latest_output("HTTP")[0]["json"]


async def test_redirects_are_followed_by_default_and_not_when_off(executor, mock_http):
    def handler(request):
        if request.url.path == "/start":
            return httpx.Response(302, headers={"location": "https://example.test/final"})
        return httpx.Response(200, json={"landed": request.url.path})
    mock_http.handler = handler
    followed = await run_http(executor, {"url": "https://example.test/start"}, version=4.5)
    assert followed.latest_output("HTTP") == [{"json": {"landed": "/final"}}]
    off = {"url": "https://example.test/start", "options": {"redirect": {"redirect": {"followRedirects": False}},
           "response": {"response": {"fullResponse": True, "neverError": True, "responseFormat": "text"}}}}
    ex = await run_http(executor, off, version=4.5)
    out = ex.latest_output("HTTP")[0]["json"]
    assert out["statusCode"] == 302 and out["headers"]["location"] == "https://example.test/final"
    # without never-error a redirect that is not followed is an error, as in n8n
    ex = await run_http(executor, {"url": "https://example.test/start", "options": {"redirect": {"redirect": {"followRedirects": False}}}})
    assert ex.status == "error" and ex.error["message"] == '302 - ""'


async def test_timeout_fails_the_node_or_becomes_an_item(executor, mock_http):
    def slow(request):
        raise httpx.ReadTimeout("took too long")
    mock_http.handler = slow
    params = {"method": "POST", "url": BUDGET_URL, "sendBody": True, "specifyBody": "json", "jsonBody": "{}",
              "options": {"timeout": 25000, "response": {"response": {"fullResponse": True, "neverError": True}}}}
    ex = await run_http(executor, params, version=4.5)
    assert ex.status == "error" and ex.error["message"] == "The connection was aborted, perhaps the server is offline"
    ex = await run_http(executor, params, version=4.5, onError="continueRegularOutput")
    [item] = ex.latest_output("HTTP")
    assert item["json"]["error"] == {"message": "timeout of 25000ms exceeded", "name": "AxiosError", "code": "ECONNABORTED",
                                     "options": {"url": BUDGET_URL, "method": "post"}}
    assert item["json"]["details"]["httpCode"] == "ECONNABORTED"
    assert item["json"]["details"]["message"] == "The connection was aborted, perhaps the server is offline"
    # consumers read r.error.message and r.statusCode (absent)
    assert "statusCode" not in item["json"]


async def test_connection_refused_message(executor, mock_http):
    def refuse(request):
        raise httpx.ConnectError("refused") from ConnectionRefusedError()
    mock_http.handler = refuse
    ex = await run_http(executor, {"url": "http://127.0.0.1:9/x"}, onError="continueRegularOutput")
    error = ex.latest_output("HTTP")[0]["json"]["error"]
    assert error["code"] == "ECONNREFUSED" and error["message"] == "connect ECONNREFUSED 127.0.0.1:9"


def test_api_error_messages():
    assert api_error_fields(RequestFailure("timeout of 5ms exceeded", "ECONNABORTED")) == (
        "The connection was aborted, perhaps the server is offline", None, "ECONNABORTED")
    assert api_error_fields(RequestFailure("connect ECONNREFUSED 1.2.3.4:80", "ECONNREFUSED"))[0].startswith("The service refused")
    body = {"error": {"message": "slow down"}}
    message, description, code = api_error_fields(RequestFailure('429 - {...}', "ERR_BAD_REQUEST", 429, "Too Many Requests", {}, body, True))
    assert (message, description, code) == ("The service is receiving too many requests from you", "slow down", "429")
    message, description, code = api_error_fields(RequestFailure('418 - "x"', None, 418, "Teapot", {}, "x", True))
    assert code == "418" and message == "Your request is invalid or could not be processed by the service" and description == "x"
    assert api_error_fields(RequestFailure("odd"))[0] == "odd"


# ---------- smaller behaviours ----------
async def test_literal_json_body_is_reserialised_like_javascript(executor, mock_http):
    params = {"method": "POST", "url": "https://example.test/j", "sendBody": True, "specifyBody": "json",
              "jsonBody": '{ "x": 1.0, "small": 0.0000001, "s": "é", "nested": {"a": [1, 2.50]} }'}
    await run_http(executor, params)
    assert mock_http.requests[0].content == '{"x":1,"small":1e-7,"s":"é","nested":{"a":[1,2.5]}}'.encode()


async def test_each_item_gets_its_own_answer_or_error_in_order(executor, mock_http):
    def handler(request):
        if request.url.path == "/bad":
            raise httpx.ConnectError("no route") from OSError("All connection attempts failed")
        return httpx.Response(200, json={"path": request.url.path})
    mock_http.handler = handler
    items = [{"json": {"u": "https://example.test/a"}}, {"json": {"u": "https://example.test/bad"}}, {"json": {"u": "https://example.test/c"}}]
    ex = await run_http(executor, {"url": "={{ $json.u }}"}, items, version=4.5, onError="continueRegularOutput")
    first, second, third = ex.latest_output("HTTP")
    assert first["json"] == {"path": "/a"} and third["json"] == {"path": "/c"}
    assert second["json"]["error"]["code"] == "ECONNREFUSED" and second["json"]["details"]["context"] == {"itemIndex": 1}


async def test_429_message_and_headers_in_the_answer(executor, mock_http):
    mock_http.handler = lambda r: httpx.Response(429, json={"message": "slow down"}, headers=[("Set-Cookie", "a=1"), ("set-cookie", "b=2"),
                                                                                         ("X-Dup", "1"), ("x-dup", "2")])
    ex = await run_http(executor, {"url": "https://example.test/x", "options": {"response": {"response": {"responseFormat": "json"}}}})
    assert ex.error["message"] == "The service is receiving too many requests from you" and ex.error["description"] == "slow down"
    ex = await run_http(executor, {"url": "https://example.test/x", "options": {"response": {"response": {
        "responseFormat": "json", "fullResponse": True, "neverError": True}}}})
    headers = ex.latest_output("HTTP")[0]["json"]["headers"]
    assert headers["set-cookie"] == ["a=1", "b=2"] and headers["x-dup"] == "1, 2"


async def test_charset_user_accept_header_and_empty_bodies(executor, mock_http):
    answers = {
        "/latin": httpx.Response(200, content="caf\xe9".encode("latin-1"), headers={"content-type": "text/plain; charset=iso-8859-1"}),
        "/none": httpx.Response(204),
    }
    mock_http.handler = lambda r: answers[r.url.path]
    text = {"url": "https://example.test/latin", "sendHeaders": True, "headerParameters": {"parameters": [{"name": "Accept", "value": "text/x-custom"}]},
            "options": {"response": {"response": {"responseFormat": "text"}}}}
    # json format: text is decoded as UTF-8 by axios, so only autodetect honours the charset
    auto = {**text, "options": {}}
    ex = await run_http(executor, auto)
    assert ex.latest_output("HTTP") == [{"json": {"data": "café"}}]
    assert mock_http.requests[0].headers["accept"] == "text/x-custom"
    full_json = {"url": "https://example.test/none", "options": {"response": {"response": {"responseFormat": "json", "fullResponse": True}}}}
    out = (await run_http(executor, full_json)).latest_output("HTTP")[0]["json"]
    assert "body" not in out and out["statusCode"] == 204
    plain_json = {"url": "https://example.test/none", "options": {"response": {"response": {"responseFormat": "json"}}}}
    assert (await run_http(executor, plain_json)).latest_output("HTTP") == [{"json": {}}]


# ---------- batching ----------
async def test_batching_waits_between_batch_starts(executor, mock_http, monkeypatch):
    sleeps: list[float] = []
    real_sleep = asyncio.sleep

    async def fake_sleep(delay, *args):
        sleeps.append(delay)
        await real_sleep(0)

    monkeypatch.setattr(asyncio, "sleep", fake_sleep)
    mock_http.handler = lambda r: httpx.Response(200, json={"path": r.url.path})
    items = [{"json": {"url": f"https://example.test/{i}"}} for i in range(5)]

    def params(batch):
        return {"url": "={{ $json.url }}", "options": {"batching": {"batch": batch}, "response": {"response": {"neverError": True}}}}

    ex = await run_http(executor, params({"batchSize": 1, "batchInterval": 10000}), items)
    assert [s for s in sleeps if s >= 1] == [10.0] * 4
    assert [i["json"]["path"] for i in ex.latest_output("HTTP")] == [f"/{i}" for i in range(5)]  # order of the input items
    sleeps.clear()
    await run_http(executor, params({"batchSize": 2, "batchInterval": 1500}), items)
    assert [s for s in sleeps if s >= 1] == [1.5, 1.5]  # before items 2 and 4
    sleeps.clear()
    await run_http(executor, params({"batchSize": 0, "batchInterval": 0}), items)  # 0 is read as 1; interval 0 is off
    await run_http(executor, {"url": "={{ $json.url }}"}, items)  # no batching option: all at once
    assert [s for s in sleeps if s >= 1] == []


async def test_all_requests_of_one_batch_run_together(executor, mock_http):
    in_flight = 0
    peak = 0

    class Concurrent(httpx.AsyncBaseTransport):
        async def handle_async_request(self, request):
            nonlocal in_flight, peak
            in_flight += 1
            peak = max(peak, in_flight)
            await asyncio.sleep(0.05)
            in_flight -= 1
            return httpx.Response(200, json={})

    await mock_http_swap(executor, Concurrent())
    await run_http(executor, {"url": "={{ $json.url }}"}, [{"json": {"url": f"https://example.test/{i}"}} for i in range(4)])
    assert peak == 4


async def mock_http_swap(executor, transport):
    executor.services.http = httpx.AsyncClient(transport=transport)


# ---------- in-process routing ----------
async def test_own_addresses_stay_in_process(executor, services, mock_http, monkeypatch):
    monkeypatch.setenv("MIDAS_OWNER_HEADER_VALUE", "owner-secret")
    seen = []

    def own_app(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"forwarded": True})

    services.self_http = httpx.AsyncClient(transport=httpx.MockTransport(own_app), base_url="https://a7.test")
    try:
        params = {"method": "POST", "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth", "sendBody": True,
                  "specifyBody": "json", "jsonBody": "={{ JSON.stringify($json.answer) }}",
                  "options": {"redirect": {"redirect": {"followRedirects": False}},
                              "response": {"response": {"fullResponse": True, "neverError": True}}, "timeout": 25000}}
        creds = {"httpHeaderAuth": {"id": "1", "name": "Claude · Midas owner header"}}
        for url in ("https://ibrahimnewaeon.app.n8n.cloud/webhook/claude-midas-a7-decision", "https://a7.test/webhook/other?x=1"):
            ex = await run_http(executor, {**params, "url": url}, [{"json": {"answer": {"id": "o-1"}}}], credentials=creds)
            assert ex.latest_output("HTTP")[0]["json"]["body"] == {"forwarded": True}
        assert [str(r.url) for r in seen] == ["https://a7.test/webhook/claude-midas-a7-decision", "https://a7.test/webhook/other?x=1"]
        assert all(r.headers["x-midas-owner-key"] == "owner-secret" and r.content == b'{"id":"o-1"}' for r in seen)
        assert mock_http.requests == []
    finally:
        await services.self_http.aclose()
        services.self_http = None


# ---------- unsupported options fail loudly ----------
@pytest.mark.parametrize("options,text", [
    ({"pagination": {"pagination": {"paginationMode": "responseContainsNextURL"}}}, "Pagination"),
    ({"proxy": "http://p:1"}, "proxy"),
    ({"allowUnauthorizedCerts": True}, "SSL"),
])
async def test_unsupported_options_are_refused(executor, mock_http, options, text):
    ex = await run_http(executor, {"url": "https://example.test/x", "options": options})
    assert ex.status == "error" and text in ex.error["message"] and mock_http.requests == []


# ---------- the real nodes of the A7 flows ----------
FLOW_PACKAGES = ("a7_main", "analysis_only", "catalogue_refresh", "model_tests", "owner_analysis", "owner_bridge")
SUPPORTED_PARAMS = {"method", "url", "authentication", "nodeCredentialType", "genericAuthType", "sendBody", "specifyBody", "jsonBody",
                    "contentType", "bodyParameters"}
SUPPORTED_OPTIONS = {"timeout", "redirect", "response", "batching"}


def real_nodes():
    for package in FLOW_PACKAGES:
        for node in importlib.import_module(f"midas_a7.flows.{package}").FLOW["nodes"]:
            if node["type"] == "n8n-nodes-base.httpRequest":
                yield package, node


def real_node(package, name):
    return next(copy.deepcopy(n) for pkg, n in real_nodes() if pkg == package and n["name"] == name)


def test_every_http_node_of_the_flows_uses_only_supported_parameters():
    seen = list(real_nodes())
    assert len(seen) == 57
    for package, node in seen:
        params = node["parameters"]
        assert node["typeVersion"] in (4.1, 4.2, 4.5), node["name"]
        assert set(params) <= SUPPORTED_PARAMS | {"options"}, (package, node["name"], set(params) - SUPPORTED_PARAMS)
        assert set(params.get("options", {})) <= SUPPORTED_OPTIONS, (node["name"], set(params["options"]) - SUPPORTED_OPTIONS)
        assert set(params.get("options", {}).get("response", {}).get("response", {})) <= {
            "fullResponse", "neverError", "responseFormat", "outputPropertyName"}, node["name"]
        assert params.get("authentication", "none") in ("none", "genericCredentialType", "predefinedCredentialType")
        if params.get("authentication") == "genericCredentialType":
            assert params["genericAuthType"] == "httpHeaderAuth"
        if params.get("authentication") == "predefinedCredentialType":
            assert params["nodeCredentialType"] in ("openAiApi", "googlePalmApi")


async def run_real(executor, package, name, stub_name, stub_json):
    """Run the node exactly as the flow defines it, after a stub node that stands in for the nodes its expressions read."""
    node = real_node(package, name)
    node["position"] = [400, 0]
    stub = {"name": stub_name, "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [200, 0],
            "parameters": {"jsCode": "return [{json: " + json.dumps(stub_json) + "}];"}}
    flow = make_flow([start(), stub, node], link(("Start", stub_name), (stub_name, name)))
    return await run_flow(executor, flow, [{"json": {}}])


@pytest.mark.parametrize("origin,expected", [("https://claude-final-midas-a7.netlify.app", "https://claude-final-midas-a7.netlify.app"),
                                             ("https://other.example", "https://midas-a7-owner-preview.netlify.app")])
async def test_real_budget_node(executor, mock_http, monkeypatch, origin, expected):
    monkeypatch.setenv("A7_BRIDGE_HEADER_VALUE", "bridge-secret")
    mock_http.handler = lambda r: httpx.Response(200, json={"send": True, "permit": "p"})
    stub = {"body": {"payload": json.dumps({"budgetOrigin": origin})}, "budgetRequest": {"stage": "03", "usd": 0.5}}
    ex = await run_real(executor, "a7_main", "Budget · 03 · Reserve", "A7 job webhook", stub)
    assert ex.status == "success", ex.error
    [req] = mock_http.requests
    assert str(req.url) == expected + "/api/a7/budget/reserve" and req.headers["authorization"] == "bridge-secret"
    assert req.content == b'{"stage":"03","usd":0.5}'
    assert ex.latest_output("Budget · 03 · Reserve")[0]["json"]["body"] == {"send": True, "permit": "p"}


async def test_real_google_and_openai_nodes(executor, mock_http, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "AIzaK")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-k")
    mock_http.handler = lambda r: httpx.Response(200, json={"id": "interactions/abc", "status": "in_progress"})
    ex = await run_real(executor, "a7_main", "15g Send to Google", "15f Build request", {"body": {"model": "g", "input": "x"}})
    assert ex.latest_output("15g Send to Google")[0]["json"]["body"]["id"] == "interactions/abc"
    ex = await run_real(executor, "a7_main", "15k Ask Google", "15h Read submission", {"s04": {"submission": {"provider_request_id": "abc"}}})
    assert ex.status == "success", ex.error
    ex = await run_real(executor, "a7_main", "03b Eye fallback (OpenAI)", "x", {"__readerBody": {"model": "m", "input": []}})
    post, get, openai = mock_http.requests
    assert str(post.url) == "https://generativelanguage.googleapis.com/v1beta/interactions?key=AIzaK" and json.loads(post.content)["model"] == "g"
    assert get.method == "GET" and str(get.url) == "https://generativelanguage.googleapis.com/v1beta/interactions/abc?key=AIzaK"
    assert str(openai.url) == "https://api.openai.com/v1/responses" and openai.headers["authorization"] == "Bearer sk-k"


async def test_real_download_and_page_nodes(executor, mock_http, monkeypatch):
    sleeps: list[float] = []
    real_sleep = asyncio.sleep

    async def fake_sleep(delay, *args):
        sleeps.append(delay)
        await real_sleep(0)

    monkeypatch.setattr(asyncio, "sleep", fake_sleep)
    png = b"\x89PNG\r\n\x1a\n" + b"1" * 40
    mock_http.handler = lambda r: httpx.Response(200, content=png, headers={"content-type": "image/png"}) if r.url.path.endswith(".png") \
        else httpx.Response(200, text="<html>list</html>", headers={"content-type": "text/html; charset=UTF-8"})
    ex = await run_real(executor, "model_tests", "Download Midas photo", "Midas link?", {"url": "https://midasfurniture.com/media/x/sofa.png"})
    ref = ex.latest_output("Download Midas photo")[0]["binary"]["data"]
    assert (ref["mimeType"], ref["fileName"], ref["bytes"]) == ("image/png", "sofa.png", len(png))
    ex = await run_real(executor, "a7_main", "19b Prop pages", "x", {"url": "https://midasfurniture.com/sofas.html"})
    page = ex.latest_output("19b Prop pages")[0]["json"]
    assert list(page) == ["data", "headers", "statusCode", "statusMessage"]  # fullResponse + text: the page sits under `data`
    assert page["data"] == "<html>list</html>" and page["headers"]["content-type"] == "text/html; charset=UTF-8" and page["statusCode"] == 200
    ex = await run_real(executor, "catalogue_refresh", "R11 Read Kuwait sitemap", "x", {"url": "https://midasfurniture.com/sitemap.xml"})
    assert ex.latest_output("R11 Read Kuwait sitemap")[0]["json"]["data"] == "<html>list</html>"
    assert mock_http.requests[-1].method == "GET"


# ---------- JavaScript compatible JSON ----------
def test_js_stringify_matches_json_stringify():
    value = {"a": 1.0, "b": 0.000001, "c": 1e21, "d": 1.5e-7, "e": 123456789012345680000.0, "f": -0.0, "g": 0.1, "h": [None, True, "é\n\"x\""],
             "i": float("nan"), "j": {"k": 10 ** 20}, "l": 100.5}
    assert js_stringify(value) == ('{"a":1,"b":0.000001,"c":1e+21,"d":1.5e-7,"e":123456789012345680000,"f":0,"g":0.1,'
                                   '"h":[null,true,"é\\n\\"x\\""],"i":null,"j":{"k":100000000000000000000},"l":100.5}')
