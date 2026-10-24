"""Secrets stay out of the service logs."""

from __future__ import annotations

import logging

from midas_a7.cli import _RedactSecrets, configure_logging


def test_resume_signatures_are_redacted_in_access_logs():
    record = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, '%s - "%s %s HTTP/%s" %d',
                               ("1.2.3.4", "POST", "/webhook-waiting/7?signature=abc123def", "1.1", 200), None)
    _RedactSecrets().filter(record)
    assert "abc123def" not in record.getMessage() and "signature=<redacted>" in record.getMessage()



def test_file_link_signatures_are_redacted_in_access_logs():
    sig = "d" * 64
    record = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, '%s - "%s %s HTTP/%s" %d',
                               ("1.2.3.4", "GET", f"/files/1{'a' * 32}/view?sig={sig}", "1.1", 200), None)
    _RedactSecrets().filter(record)
    assert sig not in record.getMessage() and "sig=<redacted>" in record.getMessage()

def test_api_keys_in_query_strings_are_redacted_in_arguments_and_in_the_message():
    record = logging.LogRecord("midas_a7.nodes.llm", logging.WARNING, __file__, 1, "03 Eye: item 0 failed: %s",
                               ("Request to https://x.test/v1beta/models/g:generateContent?key=AIzaSECRET&alt=json failed",), None)
    _RedactSecrets().filter(record)
    assert "AIzaSECRET" not in record.getMessage() and "?key=<redacted>&alt=json" in record.getMessage()
    record = logging.LogRecord("midas_a7", logging.WARNING, __file__, 1, "in the message itself: ?token=abc&x=1", None, None)
    _RedactSecrets().filter(record)
    assert record.getMessage() == "in the message itself: ?token=<redacted>&x=1"
    # Field names that merely end in "key" are not query secrets.
    assert _RedactSecrets.redact("?product_key=hero&monkey=1") == "?product_key=hero&monkey=1"


def test_http_client_request_urls_are_not_logged_and_every_root_handler_redacts():
    configure_logging()
    assert logging.getLogger("httpx").getEffectiveLevel() >= logging.WARNING
    root = logging.getLogger()
    assert all(any(isinstance(f, _RedactSecrets) for f in h.filters) for h in root.handlers)
