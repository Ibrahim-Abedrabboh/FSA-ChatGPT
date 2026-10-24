"""Database: parked runs, binary files of live runs, and the rows of A7's data tables.

SQLite for local work and tests, Postgres in production (DATABASE_URL). Calls are synchronous;
async code runs them with asyncio.to_thread.
"""

from __future__ import annotations

import contextlib
import functools
import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from sqlalchemy import (
    JSON, Column, DateTime, Integer, LargeBinary, MetaData, String, Table, Text, and_, create_engine,
    delete, func, insert, select, update,
)
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool

metadata = MetaData()

executions = Table(
    "executions", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("flow_id", String(64), nullable=False, index=True),
    Column("status", String(16), nullable=False, index=True),
    Column("state", JSON, nullable=True),
    Column("wait_till", DateTime(timezone=True), nullable=True, index=True),
    Column("wait_kind", String(16), nullable=True),
    Column("error", JSON, nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

binaries = Table(
    "binaries", metadata,
    Column("id", String(64), primary_key=True),
    Column("execution_id", String(64), nullable=False, index=True),
    Column("data", LargeBinary, nullable=False),
    Column("mime_type", String(255), nullable=True),
    Column("file_name", Text, nullable=True),
    Column("size", Integer, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

# Files the flows keep (generated images, packages, manifests). Replaces Google Drive (owner, 20 Oct 2026).
files = Table(
    "files", metadata,
    Column("id", String(64), primary_key=True),
    Column("name", Text, nullable=False),
    Column("mime_type", String(255), nullable=False),
    Column("parent_id", String(255), nullable=True, index=True),
    Column("is_folder", Integer, nullable=False, default=0),
    Column("data", LargeBinary, nullable=True),
    Column("size", Integer, nullable=False, default=0),
    Column("sha256", String(64), nullable=True),
    Column("md5", String(32), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

dt_rows = Table(
    "dt_rows", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("table_id", String(64), nullable=False, index=True),
    Column("data", JSON, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _serialized(method):
    """SQLite shares one connection between threads here; run one statement group at a time."""
    @functools.wraps(method)
    def wrapper(self, *args, **kwargs):
        with self._lock:
            return method(self, *args, **kwargs)
    return wrapper


class Store:
    def __init__(self, url: str):
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
        kwargs: dict[str, Any] = {"future": True}
        if url.startswith("sqlite"):
            kwargs["connect_args"] = {"check_same_thread": False}
            if url in ("sqlite://", "sqlite:///:memory:"):
                kwargs["poolclass"] = StaticPool
        else:
            kwargs["pool_pre_ping"] = True
        self.engine: Engine = create_engine(url, **kwargs)
        # Postgres runs concurrent calls on separate pooled connections; SQLite calls go one at a time.
        self._lock = threading.RLock() if url.startswith("sqlite") else contextlib.nullcontext()
        metadata.create_all(self.engine)

    # ---------- executions ----------
    @_serialized
    def create_execution(self, flow_id: str) -> str:
        with self.engine.begin() as c:
            res = c.execute(insert(executions).values(flow_id=flow_id, status="running", created_at=now(), updated_at=now()))
            return str(res.inserted_primary_key[0])

    @_serialized
    def save_execution(self, execution_id: str, status: str, state: dict | None, wait_till: datetime | None = None,
                       wait_kind: str | None = None, error: dict | None = None) -> None:
        with self.engine.begin() as c:
            c.execute(update(executions).where(executions.c.id == int(execution_id)).values(
                status=status, state=state, wait_till=wait_till, wait_kind=wait_kind, error=error, updated_at=now()))

    @_serialized
    def load_execution(self, execution_id: str) -> dict | None:
        with self.engine.connect() as c:
            row = c.execute(select(executions).where(executions.c.id == int(execution_id))).mappings().first()
            return dict(row) if row else None

    @_serialized
    def due_waits(self, at: datetime) -> list[str]:
        with self.engine.connect() as c:
            rows = c.execute(select(executions.c.id).where(and_(
                executions.c.status == "waiting", executions.c.wait_till.is_not(None), executions.c.wait_till <= at)))
            return [str(r[0]) for r in rows]

    @_serialized
    def claim_waiting(self, execution_id: str) -> dict | None:
        """Atomically move a waiting run to running so it is resumed once only."""
        with self.engine.begin() as c:
            res = c.execute(update(executions).where(and_(
                executions.c.id == int(execution_id), executions.c.status == "waiting")).values(status="running", updated_at=now()))
            if res.rowcount != 1:
                return None
            row = c.execute(select(executions).where(executions.c.id == int(execution_id))).mappings().first()
            return dict(row) if row else None

    @_serialized
    def run_summary(self, limit: int = 20) -> dict[str, Any]:
        """What /status shows: runs by status, the runs still active or waiting, and the latest failures (no run state)."""
        cols = [executions.c.id, executions.c.flow_id, executions.c.status, executions.c.wait_kind, executions.c.wait_till,
                executions.c.error, executions.c.created_at, executions.c.updated_at]
        with self.engine.connect() as c:
            counts = {row[0]: int(row[1]) for row in c.execute(
                select(executions.c.status, func.count()).group_by(executions.c.status))}

            def rows(*where, order):
                q = select(*cols).where(*where).order_by(order).limit(limit)
                return [dict(r) for r in c.execute(q).mappings()]
            return {
                "counts": counts,
                "running": rows(executions.c.status == "running", order=executions.c.created_at.asc()),
                "waiting": rows(executions.c.status == "waiting", order=executions.c.wait_till.asc()),
                "failed": rows(executions.c.status.in_(("error", "crashed")), order=executions.c.updated_at.desc()),
            }

    @_serialized
    def fail_interrupted(self) -> int:
        """Runs left 'running' by a stopped process cannot continue; record them as failed."""
        with self.engine.begin() as c:
            res = c.execute(update(executions).where(executions.c.status == "running").values(
                status="crashed", state=None, error={"message": "process stopped while the run was active"}, updated_at=now()))
            return res.rowcount or 0

    # ---------- binaries ----------
    @_serialized
    def put_binary(self, execution_id: str, data: bytes, mime_type: str | None, file_name: str | None) -> str:
        bid = "bin:" + uuid.uuid4().hex
        with self.engine.begin() as c:
            c.execute(insert(binaries).values(id=bid, execution_id=execution_id, data=data, mime_type=mime_type,
                                              file_name=file_name, size=len(data), created_at=now()))
        return bid

    @_serialized
    def get_binary(self, binary_id: str) -> bytes | None:
        with self.engine.connect() as c:
            row = c.execute(select(binaries.c.data).where(binaries.c.id == binary_id)).first()
            return bytes(row[0]) if row else None

    @_serialized
    def delete_binaries(self, execution_id: str) -> None:
        with self.engine.begin() as c:
            c.execute(delete(binaries).where(binaries.c.execution_id == execution_id))

    # ---------- files ----------
    @_serialized
    def file_create(self, file_id: str, name: str, mime_type: str, parent_id: str | None, data: bytes | None,
                    sha256: str | None = None, md5: str | None = None) -> dict[str, Any]:
        row = {"id": file_id, "name": name, "mime_type": mime_type, "parent_id": parent_id,
               "is_folder": 1 if data is None else 0, "data": data, "size": len(data or b""),
               "sha256": sha256, "md5": md5, "created_at": now()}
        with self.engine.begin() as c:
            c.execute(insert(files).values(**row))
        return {k: v for k, v in row.items() if k != "data"}

    @_serialized
    def file_get(self, file_id: str, with_data: bool = True) -> dict[str, Any] | None:
        cols = [files] if with_data else [c for c in files.c if c.name != "data"]
        with self.engine.connect() as c:
            row = c.execute(select(*cols).where(files.c.id == file_id)).mappings().first()
            return dict(row) if row else None

    # ---------- data tables ----------
    @staticmethod
    def _row(r: Any) -> dict[str, Any]:
        data = r.data if isinstance(r.data, dict) else json.loads(r.data)
        return {"id": r.id, **data, "createdAt": iso(r.created_at), "updatedAt": iso(r.updated_at)}

    @_serialized
    def dt_select(self, table_id: str, equals: dict[str, str] | None = None) -> list[dict[str, Any]]:
        """Rows of a table in id order. `equals` narrows by string columns in SQL; callers filter exactly."""
        q = select(dt_rows).where(dt_rows.c.table_id == table_id)
        for key, value in (equals or {}).items():
            q = q.where(dt_rows.c.data[key].as_string() == value)
        with self.engine.connect() as c:
            return [self._row(r) for r in c.execute(q.order_by(dt_rows.c.id))]

    @_serialized
    def dt_insert(self, table_id: str, data: dict[str, Any]) -> dict[str, Any]:
        t = now()
        with self.engine.begin() as c:
            res = c.execute(insert(dt_rows).values(table_id=table_id, data=data, created_at=t, updated_at=t))
            rid = res.inserted_primary_key[0]
            r = c.execute(select(dt_rows).where(dt_rows.c.id == rid)).first()
            return self._row(r)

    @_serialized
    def dt_update(self, table_id: str, ids: Iterable[int], changes: dict[str, Any]) -> list[dict[str, Any]]:
        out = []
        with self.engine.begin() as c:
            for rid in ids:
                r = c.execute(select(dt_rows).where(and_(dt_rows.c.id == rid, dt_rows.c.table_id == table_id))).first()
                if r is None:
                    continue
                data = r.data if isinstance(r.data, dict) else json.loads(r.data)
                data = {**data, **changes}
                c.execute(update(dt_rows).where(dt_rows.c.id == rid).values(data=data, updated_at=now()))
                out.append(self._row(c.execute(select(dt_rows).where(dt_rows.c.id == rid)).first()))
        return out

    @_serialized
    def dt_delete(self, table_id: str, ids: Iterable[int]) -> int:
        ids = list(ids)
        if not ids:
            return 0
        with self.engine.begin() as c:
            res = c.execute(delete(dt_rows).where(and_(dt_rows.c.table_id == table_id, dt_rows.c.id.in_(ids))))
            return res.rowcount or 0

    @_serialized
    def dt_count(self, table_id: str) -> int:
        with self.engine.connect() as c:
            return int(c.execute(select(func.count()).select_from(dt_rows).where(dt_rows.c.table_id == table_id)).scalar() or 0)

    @_serialized
    def dt_seed(self, table_id: str, rows: list[dict[str, Any]], columns: list[str]) -> int:
        """Load reference rows (model registry, handling profiles, catalogue) into an empty table."""
        if self.dt_count(table_id):
            return 0
        n = 0
        with self.engine.begin() as c:
            for row in rows:
                data = {k: row.get(k) for k in columns}
                t = now()
                c.execute(insert(dt_rows).values(table_id=table_id, data=data, created_at=t, updated_at=t))
                n += 1
        return n


def load_schemas(path: Path) -> dict[str, dict[str, Any]]:
    """Data-table schemas frozen from n8n: {table_id: {"name": ..., "columns": [{"name", "type"}]}}."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {t["id"]: t for t in raw["tables"]}
