"""HTTP Request node (n8n-nodes-base.httpRequest, typeVersion 4.1, 4.2 and 4.5 as the A7 flows use it).

Behaviour follows n8n's source (read at master, with the 1.123 request layer where it has since moved):
- packages/nodes-base/nodes/HttpRequest/V3/HttpRequestV3.node.ts      parameters, batching, output shapes
- packages/nodes-base/nodes/HttpRequest/GenericFunctions.ts           multipart / key-value bodies, binary content types
- packages/nodes-base/nodes/HttpRequest/V3/utils/{binaryData,parse,buffer-decoding,error-details}.ts
- packages/core/.../request-helpers (parseRequestObject, proxyRequestToAxios)   what goes on the wire, axios errors
- packages/core/.../utils/binary-helper-functions.ts                  prepareBinaryData, assertBinaryData
- packages/workflow/src/errors/{node-api.error,abstract/node.error}.ts   NodeApiError texts
- packages/nodes-base/credentials/OpenAiApi.credentials.ts            Authorization: Bearer <key>
- packages/@n8n/nodes-langchain/credentials/GooglePalmApi.credentials.ts   query string `key=<key>`

Supported: method, url, authentication none / header auth (the node's credential by name) / OpenAI / Google
Gemini(PaLM); body as JSON (text or object), key/value, multipart form data (text fields and n8n binary files),
form-urlencoded, raw and binary; headers; query string; options timeout, redirects, batching and response
(fullResponse, neverError, responseFormat autodetect|json|text|file, outputPropertyName). Options the flows do not
use and that cannot be done safely here (pagination, proxy, SSL client certificates, "ignore SSL issues", OAuth and
other credential types) raise a clear error instead of being ignored.

Output per input item (see `_format`): fullResponse -> {body, headers, statusCode, statusMessage} (text: the body
under outputPropertyName, file: the body as binary); otherwise the body itself, an array body giving one item per
element. Each input item is one request; the requests of a batch start together and `batchInterval` ms pass between
the starts of batches (n8n does not wait for an answer before it starts the next batch).
"""

from __future__ import annotations

import asyncio
import base64
import codecs
import copy
import json
import logging
import mimetypes
import random
import re
import socket
from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from urllib.parse import parse_qsl, quote, unquote, urlsplit

import httpx

from ..config import MissingCredential
from ..engine.executor import NodeContext, NodeError, Params, describe_error, describe_failure
from ..engine.model import Item

log = logging.getLogger(__name__)

BOM ="\N{ZERO WIDTH NO-BREAK SPACE}"
DEFAULT_TIMEOUT_MS = 300_000  # n8n: "set default timeout to 5 minutes"
# n8n's requests carry axios' user agent; shops may answer other agents differently.
USER_AGENT = "axios/1.12.2"
BODYLESS_METHODS = ("HEAD", "OPTIONS", "TRACE")
ACCEPT_JSON = "application/json,text/*;q=0.99"
ACCEPT_TEXT = "application/json,text/html,application/xhtml+xml,application/xml,text/*;q=0.9, */*;q=0.1"
ACCEPT_ANY = "application/json,text/html,application/xhtml+xml,application/xml,text/*;q=0.9, image/*;q=0.8, */*;q=0.7"

# GenericFunctions.binaryContentTypes: what "autodetect" treats as a file.
BINARY_CONTENT_TYPES = (
    "image/", "audio/", "video/", "application/octet-stream", "application/gzip", "application/zip",
    "application/vnd.rar", "application/epub+zip", "application/x-bzip", "application/x-bzip2", "application/x-cdf",
    "application/vnd.amazon.ebook", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-fontobject",
    "application/vnd.oasis.opendocument.presentation", "application/pdf", "application/x-tar", "application/vnd.visio",
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/x-7z-compressed",
)
# `extension(mime)` of the mime-types package, where Python's table differs.
MIME_EXTENSIONS = {
    "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg",
    "application/pdf": "pdf", "application/json": "json", "text/html": "html", "text/plain": "txt",
    "text/csv": "csv", "application/xml": "xml", "text/xml": "xml", "application/zip": "zip",
}

# NodeApiError texts (workflow/src/errors).
STATUS_CODE_MESSAGES = {
    "4XX": "Your request is invalid or could not be processed by the service",
    "400": "Bad request - please check your parameters",
    "401": "Authorization failed - please check your credentials",
    "402": "Payment required - perhaps check your payment details?",
    "403": "Forbidden - perhaps check your credentials?",
    "404": "The resource you are requesting could not be found",
    "405": "Method not allowed - please check you are using the right HTTP method",
    "429": "The service is receiving too many requests from you",
    "5XX": "The service failed to process your request",
    "500": "The service was not able to process your request",
    "502": "Bad gateway - the service failed to handle your request",
    "503": "Service unavailable - try again later or consider setting this node to retry automatically (in the node settings)",
    "504": "Gateway timed out - perhaps try again later?",
}
COMMON_ERRORS = {
    "ECONNREFUSED": "The service refused the connection - perhaps it is offline",
    "ECONNRESET": "The connection to the server was closed unexpectedly, perhaps it is offline. "
                  "You can retry the request immediately or wait and retry later.",
    "ENOTFOUND": "The connection cannot be established, this usually occurs due to an incorrect host (domain) value",
    "ETIMEDOUT": "The connection timed out, consider setting the 'Retry on Fail' option in the node settings",
    "ERRADDRINUSE": "The port is already occupied by some other application, if possible change the port or kill the "
                    "application that is using it",
    "EADDRNOTAVAIL": "The address is not available, ensure that you have the right IP address",
    "ECONNABORTED": "The connection was aborted, perhaps the server is offline",
    "EHOSTUNREACH": "The host is unreachable, perhaps the server is offline",
    "EAI_AGAIN": "The DNS server returned an error, perhaps the server is offline",
    "ENOENT": "The file or directory does not exist",
    "EISDIR": "The file path was expected but the given path is a directory",
    "ENOTDIR": "The directory path was expected but the given path is a file",
    "EACCES": "Forbidden by access permissions, make sure you have the right permissions",
    "EEXIST": "The file or directory already exists",
    "EPERM": "Operation not permitted, make sure you have the right permissions",
    "GETADDRINFO": "The server closed the connection unexpectedly",
}
UNKNOWN_ERROR_MESSAGE = "There was an unknown issue while executing the node"
UNKNOWN_ERROR_DESCRIPTION = ("Double-check the node configuration and the service it connects to. Check the error details "
                             'below and refer to the <a href="https://docs.n8n.io" target="_blank">n8n documentation</a> '
                             "to troubleshoot the issue.")
POSSIBLE_ERROR_MESSAGE_KEYS = (
    "cause", "error", "message", "Message", "msg", "messages", "description", "reason", "detail", "details", "errors",
    "errorMessage", "errorMessages", "ErrorMessage", "error_message", "_error_message", "errorDescription",
    "error_description", "error_summary", "error_info", "title", "text", "field", "err", "type",
)
POSSIBLE_NESTED_ERROR_OBJECT_KEYS = ("Error", "error", "err", "response", "body", "data")
POSSIBLE_ERROR_STATUS_KEYS = ("statusCode", "status", "code", "status_code", "errorCode", "error_code")


# ---------- JavaScript-compatible serialisation ----------
def _js_number(x: float) -> str:
    """Number.prototype.toString for a float (JSON.stringify prints 1.0 as 1 and 0.000001 as 0.000001)."""
    if x != x or x in (float("inf"), float("-inf")):
        return "null"
    if x == 0:
        return "0"
    sign = "-" if x < 0 else ""
    t = Decimal(repr(abs(x))).as_tuple()
    all_digits = "".join(map(str, t.digits))
    digits = all_digits.rstrip("0") or "0"
    exp = t.exponent + len(all_digits)  # value = 0.<digits> x 10^exp
    k = len(digits)
    if k <= exp <= 21:
        return sign + digits + "0" * (exp - k)
    if 0 < exp <= 21:
        return sign + digits[:exp] + "." + digits[exp:]
    if -6 < exp <= 0:
        return sign + "0." + "0" * (-exp) + digits
    e = exp - 1
    return f"{sign}{digits[0]}{'.' + digits[1:] if k > 1 else ''}e{'+' if e >= 0 else '-'}{abs(e)}"


def js_stringify(v: Any) -> str:
    """JSON.stringify(v): compact, non-ASCII kept, numbers printed the JavaScript way."""
    if v is None:
        return "null"
    if v is True:
        return "true"
    if v is False:
        return "false"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        return _js_number(v)
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, (list, tuple)):
        return "[" + ",".join(js_stringify(x) for x in v) + "]"
    if isinstance(v, dict):
        return "{" + ",".join(json.dumps(str(k), ensure_ascii=False) + ":" + js_stringify(x) for k, x in v.items()) + "}"
    return json.dumps(str(v), ensure_ascii=False)


def _reject_constant(name: str) -> Any:
    raise ValueError(f"{name} is not valid JSON")


def js_json_parse(text: str) -> Any:
    """JSON.parse: raises ValueError for what JavaScript would reject too (NaN, Infinity, empty text)."""
    return json.loads(text, parse_constant=_reject_constant)


def _truthy(v: Any) -> bool:
    """JavaScript truthiness ([] and {} are truthy)."""
    return not (v is None or v is False or v == "" or (isinstance(v, (int, float)) and not isinstance(v, bool) and v == 0))


def _text(v: Any) -> str:
    """A parameter value as the text n8n would put in a form field or query string."""
    if isinstance(v, str):
        return v
    if v is True:
        return "true"
    if v is False:
        return "false"
    if v is None:
        return ""
    return js_stringify(v) if isinstance(v, (dict, list, float)) else str(v)


def _js_type(v: Any) -> str:
    return "undefined" if v is None else "boolean" if isinstance(v, bool) else "number" if isinstance(v, (int, float)) else "object"


# ---------- bodies, query strings, names ----------
def _set_path(target: dict[str, Any], path: str, value: Any) -> None:
    """lodash.set: 'a.b' makes nested objects, 'a[0]' arrays."""
    tokens = re.findall(r"[^.\[\]]+", path)
    cur: Any = target
    for i, tok in enumerate(tokens):
        key: Any = int(tok) if isinstance(cur, list) and tok.isdigit() else tok
        if isinstance(cur, list):
            while len(cur) <= key:
                cur.append(None)
            existing = cur[key]
        else:
            existing = cur.get(key)
        if i == len(tokens) - 1:
            cur[key] = value
            return
        if not isinstance(existing, (dict, list)):
            existing = [] if tokens[i + 1].isdigit() else {}
            cur[key] = existing
        cur = existing


def _enc(s: str) -> str:
    return quote(s, safe="-_.!~*'()")


def _serialize_qs(params: dict[str, Any], array_format: str = "indices") -> str:
    """qs.stringify: nested values as a[b]=c, arrays as a[0]=x (default), a[]=x or repeated keys."""
    parts: list[str] = []

    def walk(key: str, value: Any) -> None:
        if value is None:
            return
        if isinstance(value, dict):
            for k, v in value.items():
                walk(f"{key}[{k}]", v)
        elif isinstance(value, (list, tuple)):
            for i, v in enumerate(value):
                walk(key if array_format == "repeat" else f"{key}[]" if array_format == "brackets" else f"{key}[{i}]", v)
        else:
            parts.append(f"{_enc(key)}={_enc(_text(value))}")

    for k, v in params.items():
        walk(str(k), v)
    return "&".join(parts)


def _add_param(target: dict[str, Any], name: str, value: Any, version: float) -> None:
    """updadeQueryParameterConfig: before 4.3 the last value wins, later versions collect repeats into a list."""
    if version < 4.3 or name not in target:
        target[name] = value
    elif isinstance(target[name], list):
        target[name].append(value)
    else:
        target[name] = [target[name], value]


def _path_parse(path: str) -> tuple[str, str]:
    """(base, extension without the dot) like Node's path.parse."""
    base = path.rstrip("/").rsplit("/", 1)[-1] if path else ""
    dot = base.rfind(".")
    return base, (base[dot + 1:] if dot > 0 else "")


def _mime_part(content_type: str | None) -> str | None:
    """mimeTypeFromResponse: 'image/jpeg; charset=x' -> 'image/jpeg'."""
    return content_type.split(" ")[0].split(";")[0] if content_type else None


def _content_disposition_filename(value: str | None) -> str | None:
    if not value:
        return None
    m = re.search(r"filename\*\s*=\s*[^']*'[^']*'([^;]+)", value, re.I)
    if m:
        return unquote(m.group(1).strip().strip('"'))
    m = re.search(r'filename\s*=\s*(?:"([^"]*)"|([^;]+))', value, re.I)
    if m:
        return (m.group(1) if m.group(1) is not None else m.group(2)).strip()
    return None


def _decode(data: bytes, content_type: str | None = None) -> str:
    """Text of a response: the charset of the Content-Type when it names one, else UTF-8; a BOM is dropped."""
    enc = "utf-8"
    m = re.search(r"charset=([^;,\s]+)", content_type or "", re.I)
    if m:
        try:
            enc = codecs.lookup(m.group(1).strip("'\"").lower()).name
        except LookupError:
            enc = "utf-8"
    text = data.decode(enc, errors="replace")
    return text[1:] if text.startswith(BOM) else text


# ---------- failures ----------
class RequestFailure(Exception):
    """A request that axios would have rejected: network error, timeout, or a status outside 2xx (neverError off)."""

    def __init__(self, message: str, code: str | None = None, status: int | None = None, status_text: str = "",
                 headers: dict[str, Any] | None = None, body: Any = None, has_body: bool = False):
        if status == 429:  # HttpRequestV3 rewrites the message of a 429 before anything reads it
            message = "Try spacing your requests out using the batching settings under 'Options'"
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status
        self.status_text = status_text
        self.headers = headers or {}
        self.body = body
        self.has_body = has_body

    def axios_error(self, url: str, method: str) -> dict[str, Any]:
        """What n8n puts in `json.error` when the node continues on fail (request headers and body left out: they hold secrets)."""
        out: dict[str, Any] = {"message": self.message, "name": "AxiosError"}
        if self.code:
            out["code"] = self.code
        if self.status is not None:
            out.update({"status": self.status, "statusCode": self.status})
            if self.has_body:
                out["error"] = self.body
            out["response"] = {"headers": self.headers, "status": self.status, "statusText": self.status_text}
        out["options"] = {"url": url, "method": method.lower()}
        return out


def _find_property(obj: dict[str, Any], keys: tuple[str, ...], traversal: tuple[str, ...] = ()) -> str | None:
    """NodeError.findProperty: the first message-like (or status-like) text in an error object, depth first."""
    for key in keys:
        value = obj.get(key)
        if not _truthy(value):
            continue
        if isinstance(value, str):
            try:
                value = js_json_parse(value)
            except ValueError:
                return value
            if isinstance(value, str):
                return value
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return _text(value)
        if isinstance(value, list):
            found: list[str] = []
            for el in value:
                if isinstance(el, str):
                    found.append(el)
                elif isinstance(el, (int, float)) and not isinstance(el, bool):
                    found.append(_text(el))
                elif isinstance(el, dict) and el:
                    sub = _find_property(el, keys)
                    if sub is not None:
                        found.append(sub)
            return " | ".join(found) if found else None
        if isinstance(value, dict) and value:
            prop = _find_property(value, keys)
            if prop:
                return prop
    for key in traversal:
        value = obj.get(key)
        if isinstance(value, dict) and value:
            prop = _find_property(value, keys, traversal)
            if prop:
                return prop
    return None


def api_error_fields(failure: RequestFailure) -> tuple[str, str | None, str | None]:
    """(message, description, http_code) as NodeApiError builds them from an axios error."""
    reason: dict[str, Any] = {"message": failure.message}
    if failure.code:
        reason["code"] = failure.code
    if failure.status is not None:
        reason.update({"statusCode": failure.status, "status": failure.status, "response": {
            "headers": failure.headers, "status": failure.status, "statusText": failure.status_text}})
        if failure.has_body:
            reason["error"] = failure.body
    message = reason["message"] or ""
    http_code = str(failure.status) if failure.status is not None else _find_property(
        reason, POSSIBLE_ERROR_STATUS_KEYS, POSSIBLE_NESTED_ERROR_OBJECT_KEYS)
    description = _find_property(reason, POSSIBLE_ERROR_MESSAGE_KEYS, POSSIBLE_NESTED_ERROR_OBJECT_KEYS)
    # setDefaultStatusCodeMessage
    if http_code and http_code in STATUS_CODE_MESSAGES:
        message = STATUS_CODE_MESSAGES[http_code]
    elif http_code and http_code[0] == "4":
        message = STATUS_CODE_MESSAGES["4XX"]
    elif http_code and http_code[0] == "5":
        message = STATUS_CODE_MESSAGES["5XX"]
    elif not message:
        message, description = (description, None) if description else (UNKNOWN_ERROR_MESSAGE, UNKNOWN_ERROR_DESCRIPTION)
    if message == description:
        description = None
    # setDescriptiveErrorMessage
    code = (http_code or failure.code or "").upper()
    if code in COMMON_ERRORS:
        message = COMMON_ERRORS[code]
    else:
        for known, text in COMMON_ERRORS.items():
            if known in message.upper():
                message = text
                break
    return message, description, http_code


# ---------- one request ----------
@dataclass
class Prepared:
    method: str
    url: str  # with the credential's query string
    safe_url: str  # without it: for error items and file names
    headers: dict[str, str]
    content: bytes | None
    timeout_ms: float
    follow_redirects: bool
    never_error: bool
    secrets: tuple[str, ...] = ()  # values that must never appear in an error text


@dataclass
class RawResponse:
    status: int
    reason: str
    headers: dict[str, Any]
    body: bytes
    url: str


def _opt(options: Any, *path: str) -> Any:
    cur = options
    for part in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def _has_header(headers: dict[str, str], name: str) -> bool:
    return any(k.lower() == name for k in headers)


def _drop_header(headers: dict[str, str], name: str) -> None:
    for k in [k for k in headers if k.lower() == name]:
        del headers[k]


async def _binary_bytes(ctx: NodeContext, ref: dict[str, Any]) -> bytes:
    if ref.get("id"):
        try:
            return await ctx.services.binaries.get(ref)
        except KeyError as exc:
            raise NodeError(f"The binary data of '{ref.get('fileName') or ref['id']}' is not available") from exc
    data = ref.get("data")
    return base64.b64decode(data) if isinstance(data, str) and data and data != "filesystem-v2" else b""


def _assert_binary(item: Item, name: Any, idx: int) -> dict[str, Any]:
    """this.helpers.assertBinaryData: the binary reference called `name` on the input item."""
    if not isinstance(name, str):
        raise NodeError("Provided parameter is not a string or binary data object.",
                        description='Specify the property name of the binary data in input item or use an expression to '
                                    'access the binary data in previous nodes, e.g. "{{ $(_target_node_).item.binary[_binary_property_name_] }}"')
    binary = item.get("binary")
    if binary is None:
        raise NodeError(f"This operation expects the node's input data to contain a binary file '{name}', but none was found [item {idx}]",
                        description="Make sure that the previous node outputs a binary file")
    if binary.get(name) is None:
        raise NodeError(f"The item has no binary field '{name}' [item {idx}]",
                        description="Check that the parameter where you specified the input binary field name is correct, "
                                    "and that it matches a field in the binary input")
    return binary[name]


def _multipart(fields: list[tuple[str, Any]]) -> tuple[bytes, str]:
    """A multipart/form-data body laid out like the form-data package writes it: a field value is text, or a
    (bytes, file_name, content_type) tuple for a file."""
    boundary = "--------------------------" + "".join(str(random.randrange(10)) for _ in range(24))
    out = bytearray()
    for name, value in fields:
        out += f"--{boundary}\r\n".encode()
        if isinstance(value, tuple):
            data, file_name, content_type = value
            out += f'Content-Disposition: form-data; name="{name}"; filename="{file_name}"\r\n'.encode()
            out += f"Content-Type: {content_type}\r\n\r\n".encode() + data
        else:
            out += f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode() + _text(value).encode()
        out += b"\r\n"
    out += f"--{boundary}--\r\n".encode()
    return bytes(out), f"multipart/form-data; boundary={boundary}"


def _credentials(ctx: NodeContext, p: Params, auth: str | None, generic_type: str | None) -> tuple[Any, str | None, str | None]:
    """(header credential, api-key type, api key) for the node's authentication; the secrets come from the environment."""
    try:
        if auth == "genericCredentialType":
            if generic_type != "httpHeaderAuth":
                raise NodeError(f"Authentication '{generic_type}' is not supported by this engine")
            name = ((ctx.node.credentials or {}).get("httpHeaderAuth") or {}).get("name")
            if not name:
                raise NodeError('Node does not have any credentials set for "httpHeaderAuth"')
            return ctx.services.credentials.header(name), None, None
        if auth == "predefinedCredentialType":
            cred_type = p.get("nodeCredentialType")
            if cred_type not in ("openAiApi", "googlePalmApi"):
                raise NodeError(f"Credential type '{cred_type}' is not supported by this engine")
            return None, cred_type, ctx.services.credentials.api_key(cred_type)
    except MissingCredential as exc:
        raise NodeError(str(exc)) from exc
    return None, None, None


async def _prepare(ctx: NodeContext, idx: int, p: Params, item: Item, auth: str | None, generic_type: str | None) -> Prepared:
    """Everything HttpRequestV3 does to build the request of one item."""
    version = ctx.node.type_version
    header_cred, key_type, api_key = _credentials(ctx, p, auth, generic_type)

    url = p.get("url")
    if not isinstance(url, str):
        raise NodeError(f"URL parameter must be a string, got {_js_type(url)}")
    url = url.strip()
    if not url:
        raise NodeError("URL parameter cannot be empty")
    if not url.startswith(("http://", "https://")):
        raise NodeError(f'Invalid URL: {url}. URL must start with "http" or "https".')

    options = p.get("options", {}) or {}
    for unsupported, what in (("proxy", "The proxy option"), ("allowUnauthorizedCerts", "Ignoring SSL issues"),
                              ("provideSslCertificates", "SSL client certificates")):
        if options.get(unsupported) or (unsupported == "provideSslCertificates" and p.get(unsupported, False)):
            raise NodeError(f"{what} is not supported by this engine")
    method = str(p.get("method", "GET")).upper()
    send_body = bool(p.get("sendBody", False))
    response_opts = _opt(options, "response", "response") or {}
    response_format = response_opts.get("responseFormat") or "autodetect"
    if options.get("redirect") is None:
        follow = version >= 4
    else:
        follow = bool((_opt(options, "redirect", "redirect") or {}).get("followRedirects", True))

    # ----- body -----
    content_type = p.get("contentType", "json") if send_body else ""
    specify_body = p.get("specifyBody", "keypair" if content_type == "json" else "")
    body_params = p.get("bodyParameters.parameters", []) or []
    body: Any = None
    fields: list[tuple[str, Any]] = []
    if send_body:
        if content_type == "multipart-form-data":
            for entry in body_params:
                name, value = str(entry.get("name")), entry.get("value")
                if entry.get("parameterType") == "formBinaryData":
                    field = entry.get("inputDataFieldName")
                    if not field:
                        continue  # an empty binary field name is skipped
                    ref = _assert_binary(item, field, idx)
                    file_name = (ref.get("fileName") or "file").replace("\\", "/").rsplit("/", 1)[-1]
                    mime = ref.get("mimeType") or mimetypes.guess_type(file_name)[0] or "application/octet-stream"
                    value = (await _binary_bytes(ctx, ref), file_name, mime)
                if version < 4.2:  # a plain object before 4.2: one entry per name, the last value wins
                    fields = [(n, value if n == name else v) for n, v in fields] if any(n == name for n, _ in fields) \
                        else fields + [(name, value)]
                else:
                    fields.append((name, value))
        elif specify_body == "json":
            raw = p.get("jsonBody", "")
            if isinstance(raw, (dict, list)):
                body = raw  # an expression that already gave an object
            else:
                try:
                    body = js_json_parse(raw if isinstance(raw, str) else "")
                except ValueError as exc:
                    raise NodeError('The value in the "JSON Body" field is not valid JSON', description=str(exc)) from exc
        elif specify_body == "string":
            body = dict(parse_qsl(str(p.get("body", "")), keep_blank_values=True))
        elif specify_body == "keypair" or content_type in ("json", "form-urlencoded"):
            body = {}
            for entry in body_params:
                if content_type == "json" and version >= 4:
                    _set_path(body, str(entry.get("name", "")), entry.get("value"))
                else:
                    _add_param(body, str(entry.get("name", "")), entry.get("value"), version)

    # the content type a body brings, and whether it replaces a header the user set
    content: bytes | None = None
    body_ct: tuple[str, bool] | None = None
    if send_body and method not in BODYLESS_METHODS:
        if content_type == "multipart-form-data":
            content, ct = _multipart(fields)
            body_ct = (ct, True)
        elif content_type == "form-urlencoded":
            content = _serialize_qs(body if isinstance(body, dict) else {}).encode()
            body_ct = ("application/x-www-form-urlencoded", True)
        elif content_type == "binaryData":
            ref = _assert_binary(item, p.get("inputDataFieldName"), idx)
            content = await _binary_bytes(ctx, ref)
            body_ct = (ref.get("mimeType") or "application/octet-stream", False)
        elif content_type == "raw":
            content = str(p.get("body", "")).encode()
            body_ct = (str(p.get("rawContentType", "")), True)
        elif body is not None:
            content = body.encode() if isinstance(body, str) else js_stringify(body).encode()
            body_ct = ("application/json", False)

    # ----- query string -----
    qs: dict[str, Any] = {}
    if p.get("sendQuery", False):
        if p.get("specifyQuery", "keypair") == "keypair":
            for entry in p.get("queryParameters.parameters", []) or []:
                _add_param(qs, str(entry.get("name", "")), entry.get("value"), version)
        else:
            qs = _json_param(p.get("jsonQuery", ""), "JSON Query Parameters")

    # ----- headers -----
    headers: dict[str, str] = {}
    if p.get("sendHeaders", False):
        if p.get("specifyHeaders", "keypair") == "keypair":
            extra: dict[str, Any] = {}
            for entry in p.get("headerParameters.parameters", []) or []:
                if entry.get("name"):
                    _add_param(extra, str(entry["name"]), entry.get("value"), version)
        else:
            extra = _json_param(p.get("jsonHeaders", ""), "JSON Headers")
        lowercase = options.get("lowercaseHeaders")
        for k, v in extra.items():
            k = str(k).lower() if lowercase is None or lowercase else str(k)
            _drop_header(headers, k.lower())
            headers[k] = _text(v)
    if body_ct is not None and (body_ct[1] or not _has_header(headers, "content-type")):
        _drop_header(headers, "content-type")
        headers["content-type"] = body_ct[0]

    # ----- credentials -----
    credential_qs: dict[str, Any] = {}
    if header_cred is not None:
        _drop_header(headers, header_cred.header.lower())
        headers[header_cred.header] = header_cred.value
    elif key_type == "openAiApi":
        _drop_header(headers, "authorization")
        headers["Authorization"] = f"Bearer {api_key}"
    elif key_type == "googlePalmApi":
        credential_qs["key"] = api_key

    if not _has_header(headers, "accept"):
        headers["accept"] = ACCEPT_JSON if response_format == "json" else ACCEPT_TEXT if response_format == "text" else ACCEPT_ANY
    if not _has_header(headers, "user-agent"):
        headers["user-agent"] = USER_AGENT

    def with_query(params: dict[str, Any]) -> str:
        base = url.split("#", 1)[0]
        text = _serialize_qs(params, options.get("queryParameterArrays") or "indices")
        return base + ("&" if "?" in base else "?") + text if text else base

    return Prepared(method=method, url=with_query({**qs, **credential_qs}), safe_url=with_query(qs), headers=headers,
                    content=content, timeout_ms=float(options.get("timeout") or DEFAULT_TIMEOUT_MS), follow_redirects=follow,
                    never_error=bool(response_opts.get("neverError", False)), secrets=(api_key,) if api_key else ())


def _json_param(raw: Any, field: str) -> dict[str, Any]:
    try:
        value = raw if isinstance(raw, dict) else js_json_parse(raw)
    except (ValueError, TypeError) as exc:
        raise NodeError(f'The value in the "{field}" field is not valid JSON', description=str(exc)) from exc
    return value if isinstance(value, dict) else {}


def _response_headers(response: httpx.Response) -> dict[str, Any]:
    """Lower-cased names like Node's; repeated headers are joined, set-cookie stays a list."""
    out: dict[str, Any] = {}
    for key, value in response.headers.multi_items():
        key = key.lower()
        if key == "set-cookie":
            out.setdefault(key, []).append(value)
        else:
            out[key] = f"{out[key]}, {value}" if key in out else value
    if str(out.get("content-encoding", "")).lower() in ("gzip", "compress", "deflate", "br", "zstd"):
        del out["content-encoding"]  # axios decompresses and then drops the header
    return out


async def _send(ctx: NodeContext, req: Prepared) -> RawResponse:
    """Run the request; addresses of this service go to the app's own client. Failures are shaped like axios errors."""
    client, url = ctx.services.route(req.url)
    ms = int(req.timeout_ms) if float(req.timeout_ms).is_integer() else req.timeout_ms
    try:
        resp = await client.request(req.method, url, headers=req.headers, content=req.content,
                                    timeout=httpx.Timeout(req.timeout_ms / 1000.0), follow_redirects=req.follow_redirects)
    except httpx.TimeoutException as exc:
        raise RequestFailure(f"timeout of {ms}ms exceeded", "ECONNABORTED") from exc
    except httpx.TooManyRedirects as exc:
        raise RequestFailure("Maximum number of redirects exceeded", "ERR_FR_TOO_MANY_REDIRECTS") from exc
    except httpx.TransportError as exc:
        raise _transport_failure(exc, req) from exc
    except Exception as exc:  # whatever else a transport raises is a failure of this one request
        text = str(exc) or exc.__class__.__name__
        for secret in req.secrets:
            text = text.replace(secret, "[removed]")
        raise RequestFailure(text) from exc
    return RawResponse(status=resp.status_code, reason=resp.reason_phrase or "", headers=_response_headers(resp),
                       body=resp.content, url=str(resp.url))


def _transport_failure(exc: httpx.TransportError, req: Prepared) -> RequestFailure:
    """Node-style codes (ENOTFOUND, ECONNREFUSED, ECONNRESET) from what httpx/anyio report, found along the cause chain."""
    parts = urlsplit(req.safe_url)
    target = f"{parts.hostname}:{parts.port or (443 if parts.scheme == 'https' else 80)}"
    chain: list[BaseException] = []
    cur: BaseException | None = exc
    while cur is not None and cur not in chain and len(chain) < 8:
        chain.append(cur)
        cur = cur.__cause__ or cur.__context__
    code: str | None = None
    for e in chain:
        if isinstance(e, socket.gaierror):
            code = "ENOTFOUND"
        elif isinstance(e, ConnectionRefusedError) or (isinstance(e, OSError) and "All connection attempts failed" in str(e)):
            code = "ECONNREFUSED"
        elif isinstance(e, (ConnectionResetError, BrokenPipeError)):
            code = "ECONNRESET"
        if code:
            break
    if code is None and isinstance(exc, httpx.RemoteProtocolError):
        code = "ECONNRESET"
    message = {"ENOTFOUND": f"getaddrinfo ENOTFOUND {parts.hostname}", "ECONNREFUSED": f"connect ECONNREFUSED {target}",
               "ECONNRESET": "socket hang up"}.get(code or "")
    if message is None:
        message = str(exc) or exc.__class__.__name__
        for secret in req.secrets:
            message = message.replace(secret, "[removed]")
    return RequestFailure(message, code)


# ---------- the answer ----------
def _axios_parse(text: str) -> Any:
    """axios' default transformResponse: text that is JSON becomes data, anything else stays text; empty is undefined."""
    if text == "":
        return None
    try:
        return js_json_parse(text)
    except ValueError:
        return text


def _failure_for_status(raw: RawResponse, parse_json: bool) -> RequestFailure:
    """The axios error for a status outside 2xx: message '<status> - <JSON of the body>'."""
    text = _decode(raw.body, raw.headers.get("content-type"))
    body: Any = text
    if parse_json:
        try:
            body = js_json_parse(text)
        except ValueError:
            body = text
    code = {4: "ERR_BAD_REQUEST", 5: "ERR_BAD_RESPONSE"}.get(raw.status // 100)
    return RequestFailure(f"{raw.status} - {js_stringify(body)}", code, raw.status, raw.reason, raw.headers, body, True)


def _as_json_object(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    raise NodeError("A 'json' property isn't an object", description="In the returned data, every key named 'json' must point to an object.")


async def _store_file(ctx: NodeContext, raw: RawResponse, req: Prepared, output_name: str) -> dict[str, Any]:
    """prepareBinaryData for a downloaded stream, then HttpRequestV3's setFilename."""
    mime = _mime_part(raw.headers.get("content-type"))
    path = _content_disposition_filename(raw.headers.get("content-disposition")) or urlsplit(raw.url).path[1:]
    if not mime and path:
        mime = mimetypes.guess_type(path)[0]
    mime = mime or "text/plain"
    ext = MIME_EXTENSIONS.get(mime) or (mimetypes.guess_extension(mime) or "").lstrip(".") or None
    file_name: str | None = None
    if path:
        file_name, path_ext = _path_parse(path)
        ext = path_ext or ext
    if not file_name and ext:
        uri = req.safe_url.split("?", 1)[0]
        file_name = uri.split("/")[-1] if uri.endswith(ext) else f"{output_name or 'data'}.{ext}"
    return await ctx.services.binaries.put(ctx.execution.id, raw.body, mime, file_name or None, ext)


async def _format(ctx: NodeContext, item: Item, raw: RawResponse, req: Prepared, p0: Params) -> list[Item]:
    """The item(s) HttpRequestV3 returns for one answer."""
    response_opts = _opt(p0.get("options", {}) or {}, "response", "response") or {}
    full = bool(response_opts.get("fullResponse", False))
    fmt = response_opts.get("responseFormat") or "autodetect"
    out_name = response_opts.get("outputPropertyName") or "data"
    never_error = bool(response_opts.get("neverError", False))
    content_type = raw.headers.get("content-type") or ""

    body: Any
    if fmt in ("autodetect", "file"):
        body = raw.body  # a stream in n8n
        if fmt == "autodetect":
            if "application/json" in content_type:
                fmt = "json"
                text = _decode(raw.body, content_type)
                try:
                    body = js_json_parse(text) if text.strip() else {}
                except ValueError:
                    if not never_error:
                        raise NodeError("Invalid JSON in response body") from None
                    body = {}
            elif any(t in content_type for t in BINARY_CONTENT_TYPES):
                fmt = "file"
            else:
                fmt = "text"
                body = _decode(raw.body, content_type) or None
    else:  # json and text: axios already turned JSON text into data
        body = _axios_parse(raw.body.decode("utf-8", errors="replace").removeprefix(BOM))

    meta = {"headers": raw.headers, "statusCode": raw.status, "statusMessage": raw.reason}

    if fmt == "file":
        binary = dict(item.get("binary") or {})
        binary[out_name] = await _store_file(ctx, raw, req, out_name)
        return [{"json": meta if full else copy.deepcopy(item.get("json") or {}), "binary": binary}]

    if fmt == "text":
        text_value = js_stringify(body) if isinstance(body, (dict, list)) else body
        data = {} if text_value is None else {out_name: text_value}
        return [{"json": {**data, **meta} if full else data}]

    # json
    if isinstance(body, str):
        try:
            body = {} if not body.strip() else js_json_parse(body)
        except ValueError:
            raise NodeError('Response body is not valid JSON. Change "Response Format" to "Text"') from None
    if full:
        return [{"json": ({} if body is None else {"body": body}) | meta}]
    if isinstance(body, list):
        return [{"json": _as_json_object(el)} for el in body]
    return [{"json": _as_json_object(body)}]


# ---------- the node ----------
async def handler(ctx: NodeContext):
    items = ctx.items
    if not items:
        return [[]]
    params = await ctx.params()
    version = ctx.node.type_version
    p0 = params[0]
    try:
        auth = p0.get("authentication", "none")
    except NodeError:
        auth = None
    generic_type = p0.get("genericAuthType") if auth == "genericCredentialType" else None
    pagination = p0.get("options.pagination.pagination")
    if isinstance(pagination, dict) and pagination.get("paginationMode", "off") != "off":
        raise NodeError("Pagination is not supported by this engine")

    tasks: dict[int, asyncio.Task[RawResponse]] = {}
    prepared: dict[int, Prepared] = {}
    errors: dict[int, str] = {}
    try:
        for idx, item in enumerate(items):
            try:
                # Batching: before each batch but the first, wait batchInterval; a request is not awaited before the next starts.
                batching = _opt(params[idx].get("options", {}) or {}, "batching", "batch")
                if batching is not None:
                    size, interval = batching.get("batchSize", 50), batching.get("batchInterval", 1000)
                    size = size if isinstance(size, (int, float)) and size > 0 else 1
                    if idx > 0 and isinstance(interval, (int, float)) and interval > 0 and idx % size == 0:
                        await asyncio.sleep(interval / 1000.0)
                prepared[idx] = await _prepare(ctx, idx, params[idx], item, auth, generic_type)
            except Exception as exc:  # like n8n: any failure while building a request is that item's error
                if not ctx.continue_on_fail:
                    raise
                log.warning("%s: item %d could not be prepared: %s", ctx.node.name, idx, describe_error(exc))
                errors[idx] = str(exc)
                continue
            tasks[idx] = asyncio.ensure_future(_send(ctx, prepared[idx]))
        results = dict(zip(tasks, await asyncio.gather(*tasks.values(), return_exceptions=True)))
    except BaseException:
        for t in tasks.values():
            t.cancel()
        await asyncio.gather(*tasks.values(), return_exceptions=True)
        raise

    parse_error_body = (_opt(p0.get("options", {}) or {}, "response", "response", "responseFormat") or "autodetect") in ("json", "text")
    out: list[Item] = []
    for idx, item in enumerate(items):
        if idx in errors:
            out.append({"json": {"error": errors[idx]}})
            continue
        req, result = prepared[idx], results[idx]
        failure: RequestFailure | None = None
        if isinstance(result, RequestFailure):
            failure = result
        elif isinstance(result, BaseException):
            raise result
        elif not req.never_error and not 200 <= result.status < 300:
            failure = _failure_for_status(result, parse_error_body)
        if failure is not None:
            message, description, http_code = api_error_fields(failure)
            if not ctx.continue_on_fail:
                raise NodeError(message, description, http_code)
            log.warning("%s: item %d failed: %s", ctx.node.name, idx, describe_failure(message, description, http_code))
            error_json: dict[str, Any] ={"error": failure.axios_error(req.safe_url, req.method)}
            if version >= 4.5:
                details: dict[str, Any] = {"message": message}
                if description:
                    details["description"] = description
                details["httpCode"] = http_code
                if failure.has_body:
                    details["body"] = failure.body
                details["context"] = {"itemIndex": idx}
                error_json["details"] = details
            out.append({"json": error_json})
            continue
        try:
            out.extend(await _format(ctx, item, result, req, p0))
        except Exception as exc:
            if not ctx.continue_on_fail:
                raise
            log.warning("%s: item %d answered but the response could not be read: %s", ctx.node.name, idx, describe_error(exc))
            out.append({"json": {"error": str(exc)}})
    return [out]


HANDLERS = {"httpRequest": handler}
