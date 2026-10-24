"""Data Table node (n8n-nodes-base.dataTable, typeVersion 1 and 1.1) on the SQL table dt_rows.

Behaviour follows n8n master: packages/nodes-base/nodes/DataTable (router, row operations, common/*) for the
node itself and packages/cli/src/modules/data-table (service, rows repository, sql-utils) plus
packages/workflow/src/type-validation.ts for what the table does to values and filters.

What matters for the A7 flows:
- `operation` defaults to insert, `matchType` to anyCondition (OR), `condition` to eq, `limit` to 50,
  `orderByDirection` to DESC (n8n fills parameter defaults when it loads a workflow).
- Insert (with a fixed table id) is one bulk call for all input items; every other operation runs per item.
- Values are coerced to the column type the way the table service does it (see `_coerce_cell`); columns that
  are not given are NULL on insert; update sets exactly the columns given (an expression that is undefined/null
  sets NULL).
- Output rows are {<columns in table order>, id, createdAt, updatedAt}, one item per row.
"""

from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any

from ..engine.executor import NodeContext, NodeError
from ..engine.model import Item
from ..store import Store, iso, now

SYSTEM_COLUMNS = ("id", "createdAt", "updatedAt")
SYSTEM_TYPES = {"id": "number", "createdAt": "date", "updatedAt": "date"}
ANY_CONDITION, ALL_CONDITIONS = "anyCondition", "allConditions"
ROWS_LIMIT_DEFAULT = 50
VALIDATION_PREFIX = "Validation error with data table request: "
_LUXON_DOCS = "https://moment.github.io/luxon/api-docs/index.html#datetimefromformat"

# Reference tables that A7 reads and never writes; loaded from data/seeds/<tableId>.json into empty tables.
SEEDED_TABLES = ("eso9cF84jXYIGu5S", "AgXKkFbIj5dQAnvn", "lwJbRv4TVqlFTILl")


class _DtError(Exception):
    """A failure of this node. `node_error` mirrors n8n's NodeOperationError (shown on the item when the node
    continues on fail); the validation errors of the table service are plain errors and carry no item error."""

    def __init__(self, message: str, description: str | None = None, node_error: bool = True):
        super().__init__(message)
        self.description = description
        self.node_error = node_error


def _validation(message: str) -> _DtError:
    return _DtError(VALIDATION_PREFIX + message, node_error=False)


@dataclass
class _Table:
    id: str
    name: str
    columns: list[tuple[str, str]]  # (name, type) in table order

    @property
    def types(self) -> dict[str, str]:
        return dict(self.columns)

    @property
    def all_types(self) -> dict[str, str]:
        return {**SYSTEM_TYPES, **self.types}


@dataclass
class _Filter:
    column: str
    condition: str
    value: Any
    ctype: str | None


@dataclass
class _FilterSet:
    kind: str  # "and" | "or"
    filters: list[_Filter]


# ---------- JavaScript value semantics the table service relies on ----------
_NUMBER_RE = re.compile(r"[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?")


def _js_str(v: Any) -> str:
    """String(v) for the scalar values a cell can hold."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        if v != v:
            return "NaN"
        if v in (float("inf"), float("-inf")):
            return "Infinity" if v > 0 else "-Infinity"
        if v.is_integer() and abs(v) < 1e21:
            return str(int(v))
        return repr(v)
    return str(v)


def _js_number(v: Any) -> float | None:
    """Number(v); None stands for NaN. Empty or blank strings are 0, like in JavaScript."""
    if isinstance(v, bool):
        return 1.0 if v else 0.0
    if isinstance(v, (int, float)):
        return None if v != v else float(v)
    s = str(v).strip()
    if s == "":
        return 0.0
    if _NUMBER_RE.fullmatch(s):
        return float(s)
    m = re.fullmatch(r"0([xXoObB])([0-9a-fA-F]+)", s)
    if m:
        base = {"x": 16, "o": 8, "b": 2}[m.group(1).lower()]
        try:
            return float(int(m.group(2), base))
        except ValueError:
            return None
    if s in ("Infinity", "+Infinity"):
        return float("inf")
    if s == "-Infinity":
        return float("-inf")
    return None


def _num_out(f: float) -> int | float:
    return int(f) if f.is_integer() and abs(f) < 2**53 else f


def _describe(v: Any) -> str:
    """getValueDescription from type-validation.ts."""
    if isinstance(v, (dict, list)):
        return "array" if isinstance(v, list) else "object"
    return f"'{_js_str(v)}'"


def _parse_datetime(value: Any) -> datetime | None:
    """A date the way luxon (ISO, HTTP, RFC2822, SQL) and Date.parse read it. Zone-less values are UTC."""
    if isinstance(value, datetime):
        dt = value
    else:
        s = str(value).strip()
        dt = None
        if s:
            try:
                dt = datetime.fromisoformat(s)
            except ValueError:
                try:
                    dt = parsedate_to_datetime(s)
                except (TypeError, ValueError, IndexError):
                    dt = None
            if dt is None:
                for fmt in ("%b %d, %Y %H:%M:%S", "%b %d, %Y", "%B %d, %Y %H:%M:%S", "%B %d, %Y", "%m/%d/%Y %H:%M:%S", "%m/%d/%Y",
                            "%d %b %Y %H:%M:%S", "%d %B %Y"):
                    try:
                        dt = datetime.strptime(s, fmt)
                        break
                    except ValueError:
                        continue
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _iso_ms(dt: datetime) -> str:
    return iso(dt)


# ---------- values -> column types (DataTableService.validateAndTransformCell) ----------
def _coerce_cell(key: str, cell: Any, ctype: str | None, skip_date_transform: bool = False) -> Any:
    if cell is None or ctype is None:
        return cell
    if ctype == "string":
        return cell  # parseStrings is off: whatever arrives is kept (the database turns numbers into text)
    if ctype == "number":
        n = _js_number(cell)
        if n is None or n in (float("inf"), float("-inf")):
            raise _validation(f"value '{_js_str(cell)}' does not match column type 'number': "
                              f"'{key}' expects a number but we got {_describe(cell)}")
        return _num_out(n)
    if ctype == "boolean":
        return _parse_boolean(key, cell)
    if ctype == "date":
        dt = _parse_datetime(cell)
        if dt is None:
            raise _validation(f"value '{_js_str(cell)}' does not match column type 'date': "
                              f"'{key}' expects a dateTime but we got {_describe(cell)} <br/><br/> Consider using "
                              f'<a href="{_LUXON_DOCS}" target="_blank"><code>DateTime.fromFormat</code></a> '
                              "to work with custom date formats.")
        return dt if skip_date_transform else _iso_ms(dt)
    return cell


def _parse_boolean(key: str, cell: Any) -> bool:
    if isinstance(cell, bool):
        return cell
    if isinstance(cell, str) and cell.lower() in ("true", "false"):
        return cell.lower() == "true"
    if not (isinstance(cell, str) and cell.strip() == ""):
        n = _js_number(cell)
        if n == 0:
            return False
        if n == 1:
            return True
    raise _validation(f"value '{_js_str(cell)}' does not match column type 'boolean': "
                      f"'{key}' expects a boolean but we got {_describe(cell)}")


def _to_storage(value: Any, ctype: str | None) -> Any:
    """What the database keeps for a coerced value: text columns hold the text of numbers and booleans."""
    if ctype == "string" and value is not None and not isinstance(value, str):
        return _js_str(value)
    return value


def _api_input(data: Any, index: int) -> dict[str, Any]:
    """dataObjectToApiInput: undefined and null become null; arrays and objects are refused."""
    if data is None:
        raise _DtError("Cannot convert undefined or null to object")
    out: dict[str, Any] = {}
    for k, v in dict(data).items():
        if isinstance(v, list):
            raise _DtError(f"unexpected array input '{_dumps(v)}' in row {index}")
        if isinstance(v, dict):
            raise _DtError(f"unexpected object input '{_dumps(v)}' in row {index}")
        out[k] = v
    return out


def _dumps(v: Any) -> str:
    return json.dumps(v, separators=(",", ":"), ensure_ascii=False)


def _get_add_row(params: Any, item: Item, index: int) -> dict[str, Any]:
    """getAddRow: the columns.value map (defineBelow) or the input item itself without the system columns."""
    mode = params.get("columns.mappingMode", "defineBelow")
    if mode == "autoMapInputData":
        data = {k: v for k, v in (item.get("json") or {}).items() if k not in SYSTEM_COLUMNS}
    else:
        data = params.get("columns.value", {})
        if data is None:
            raise _DtError("Cannot convert undefined or null to object")
    return _api_input(data, index)


def _coerce_row(row: dict[str, Any], tbl: _Table) -> dict[str, Any]:
    """validateAndTransformRows for one row: unknown columns are refused, values are coerced to the column type."""
    types = tbl.types
    out: dict[str, Any] = {}
    for key, value in row.items():
        if key not in types:
            raise _validation(f"unknown column name '{key}'")
        out[key] = _coerce_cell(key, value, types[key])
    return out


def _stored(row: dict[str, Any], tbl: _Table) -> dict[str, Any]:
    types = tbl.types
    return {k: _to_storage(v, types.get(k)) for k, v in row.items()}


# ---------- tables and rows ----------
def _resolve_table(ctx: NodeContext, params: Any) -> _Table:
    rl = params.get("dataTableId")
    if isinstance(rl, dict) and "value" in rl:
        mode, value = rl.get("mode", "list"), rl["value"]
    else:
        mode, value = "id", rl
    schemas = ctx.services.schemas
    if mode == "name":
        for tid, t in schemas.items():
            if str(t.get("name", "")).lower() == str(value).lower():
                value = tid
                break
        else:
            raise _DtError(f'Data table with name "{value}" not found')
    schema = schemas.get(str(value))
    if schema is None:
        raise _DtError(f"Data table with ID '{value}' could not be found in this project",
                       "It may have been deleted, or skipped when the workflow was imported. "
                       "Choose an existing data table in the node.")
    return _Table(str(value), schema.get("name", ""), [(c["name"], c["type"]) for c in schema["columns"]])


def _read_value(v: Any, ctype: str) -> Any:
    """normalizeRows: 0/1 become booleans, dates come back as UTC ISO strings."""
    if ctype == "boolean":
        if v in (1, "1") and not isinstance(v, bool):
            return True
        if v in (0, "0") and not isinstance(v, bool):
            return False
    elif ctype == "date" and v is not None:
        dt = _parse_datetime(v)
        return _iso_ms(dt) if dt else v
    return v


def _present(row: dict[str, Any], tbl: _Table) -> dict[str, Any]:
    """A stored row as n8n returns it: the table's columns in order (NULL when absent), then id, createdAt, updatedAt."""
    out = {name: _read_value(row.get(name), ctype) for name, ctype in tbl.columns}
    out["id"], out["createdAt"], out["updatedAt"] = row["id"], row["createdAt"], row["updatedAt"]
    return out


# ---------- filters (getSelectFilter, buildGetManyFilter, validateAndTransformFilters) ----------
def _node_filters(params: Any, tbl: _Table, force_eq: bool = False) -> tuple[str, list[_Filter]]:
    """getSelectFilter + buildGetManyFilter: what the node itself checks and maps, before the table service sees it."""
    fields = params.get("filters.conditions", [])
    match_type = params.get("matchType", ANY_CONDITION)
    if match_type not in (ANY_CONDITION, ALL_CONDITIONS):
        raise _DtError("unexpected match type")
    if not isinstance(fields, list) or not all(isinstance(f, dict) and "keyName" in f for f in fields):
        raise _DtError("unexpected fields input")
    types = tbl.all_types
    if fields:
        invalid = [f["keyName"] for f in fields if not types.get(f["keyName"])]
        if invalid:
            raise _DtError(
                f'Filter validation failed: Column(s) "{", ".join(str(i) for i in invalid)}" do not exist in the selected '
                "table. This often happens when switching between tables with different schemas. "
                "Please update your filter conditions.")
    return ("and" if match_type == ALL_CONDITIONS else "or"), [_node_filter(f, types, force_eq) for f in fields]


def _service_filters(kind: str, filters: list[_Filter], tbl: _Table) -> _FilterSet:
    """DataTableService.validateAndTransformFilters."""
    return _FilterSet(kind, [_transform_filter(f, tbl.all_types) for f in filters])


def _node_filter(f: dict[str, Any], types: dict[str, str], force_eq: bool) -> _Filter:
    name = f["keyName"]
    ctype = types.get(name)
    cond = None if force_eq else f.get("condition")
    if cond == "isEmpty":
        return _Filter(name, "isEmpty" if ctype == "string" else "eq", None, ctype)
    if cond == "isNotEmpty":
        return _Filter(name, "isNotEmpty" if ctype == "string" else "neq", None, ctype)
    if cond in ("isTrue", "isFalse"):
        return _Filter(name, "eq", cond == "isTrue", ctype)
    value = f.get("keyValue", "")
    if ctype == "date" and isinstance(value, str):
        parsed = _parse_datetime(value)
        if parsed is None:
            raise _DtError(f"Invalid date string '{value}' for column '{name}'")
        value = parsed
    return _Filter(name, cond or "eq", value, ctype)


def _transform_filter(flt: _Filter, types: dict[str, str]) -> _Filter:
    value = _coerce_cell(flt.column, flt.value, flt.ctype, skip_date_transform=True)
    cond = flt.condition
    if flt.ctype != "string":
        if cond == "isEmpty":
            return _Filter(flt.column, "eq", None, flt.ctype)
        if cond == "isNotEmpty":
            return _Filter(flt.column, "neq", None, flt.ctype)
    if cond in ("like", "ilike"):
        if value is None:
            raise _validation(f"{cond.upper()} filter value cannot be null or undefined")
        if not isinstance(value, str):
            raise _validation(f"{cond.upper()} filter value must be a string")
        value = value if "%" in value else f"%{value}%"
    elif cond in ("gt", "gte", "lt", "lte"):
        if value is None:
            raise _validation(f"{cond.upper()} filter value cannot be null or undefined")
    elif cond not in ("eq", "neq", "isEmpty", "isNotEmpty"):
        raise _DtError(f"Unsupported filter condition: {cond}")
    return _Filter(flt.column, cond, value, flt.ctype)


def _comparable(v: Any, ctype: str | None) -> Any:
    """A cell or filter value in a form that compares like the database compares it; None when it cannot."""
    if v is None:
        return None
    if ctype == "number":
        n = _js_number(v)
        return n
    if ctype == "date":
        return _parse_datetime(v)
    if ctype == "boolean":
        try:
            return _parse_boolean("", v)
        except _DtError:
            return None
    return v if isinstance(v, str) else _js_str(v)


def _like_regex(pattern: str, ignore_case: bool) -> re.Pattern[str]:
    # Only % is a wildcard; every other character, '_' and '*' included, is literal.
    body = ".*".join(re.escape(p) for p in pattern.split("%"))
    return re.compile(body, re.DOTALL | (re.IGNORECASE if ignore_case else 0))


def _matches_one(row: dict[str, Any], f: _Filter) -> bool:
    cur = row.get(f.column)
    cond = f.condition
    if cond == "isEmpty":
        return cur is None or cur == ""
    if cond == "isNotEmpty":
        return cur is not None and cur != ""
    if f.value is None and cond in ("eq", "neq"):
        return (cur is None) if cond == "eq" else (cur is not None)
    if cur is None:
        return cond == "neq"  # (col != value OR col IS NULL); every other comparison with NULL is false
    if cond in ("like", "ilike"):
        return _like_regex(f.value, cond == "ilike").fullmatch(cur if isinstance(cur, str) else _js_str(cur)) is not None
    a, b = _comparable(cur, f.ctype), _comparable(f.value, f.ctype)
    if a is None or b is None:
        return cond == "neq"
    if cond == "eq":
        return a == b
    if cond == "neq":
        return a != b
    return {"gt": a > b, "gte": a >= b, "lt": a < b, "lte": a <= b}[cond]


def _matches(row: dict[str, Any], fs: _FilterSet) -> bool:
    if not fs.filters:
        return True
    if len(fs.filters) == 1 or fs.kind == "and":
        return all(_matches_one(row, f) for f in fs.filters)
    return any(_matches_one(row, f) for f in fs.filters)


def _prefilter(fs: _FilterSet) -> dict[str, str]:
    """Equality tests on string columns that the SQL side may apply early (they are re-checked in Python)."""
    if not (len(fs.filters) == 1 or fs.kind == "and"):
        return {}
    equals: dict[str, str] = {}
    for f in fs.filters:
        if f.condition == "eq" and f.ctype == "string" and isinstance(f.value, str) and f.column not in equals:
            equals[f.column] = f.value
    return equals


async def _select(ctx: NodeContext, tbl: _Table, fs: _FilterSet) -> list[dict[str, Any]]:
    equals = _prefilter(fs)
    rows = await asyncio.to_thread(ctx.services.store.dt_select, tbl.id, equals or None)
    shown = [_present(r, tbl) for r in rows]
    return [r for r in shown if _matches(r, fs)]


def _sort(rows: list[dict[str, Any]], column: str, direction: str, ctype: str | None) -> list[dict[str, Any]]:
    """ORDER BY column direction, id ASC. NULLs sort last ascending and first descending (Postgres)."""
    def key(row: dict[str, Any]):
        c = _comparable(row.get(column), ctype)
        return (1, 0) if c is None else (0, c)

    ordered = sorted(rows, key=lambda r: r["id"])
    return sorted(ordered, key=key, reverse=direction == "DESC")


def _truthy(v: Any) -> bool:
    if isinstance(v, str):
        return v.strip().lower() == "true"
    return bool(v)


# ---------- row operations ----------
async def _op_get(ctx: NodeContext, tbl: _Table, params: Any, index: int) -> list[dict[str, Any]]:
    sort: tuple[str, str] | None = None
    if _truthy(params.get("orderBy", False)):
        column = params.get("orderByColumn", "createdAt")
        if column:
            if column not in SYSTEM_COLUMNS and column not in tbl.types:
                raise _DtError("Specified column does not exist")
            sort = (column, str(params.get("orderByDirection", "DESC")).upper())
    kind, filters = _node_filters(params, tbl)
    rows = await _select(ctx, tbl, _service_filters(kind, filters, tbl))
    if sort:
        rows = _sort(rows, sort[0], sort[1], tbl.all_types.get(sort[0]))
    limit: Any = 0 if _truthy(params.get("returnAll", False)) else params.get("limit", ROWS_LIMIT_DEFAULT)
    if limit:
        try:
            n = int(float(limit))
        except (TypeError, ValueError) as exc:
            raise _DtError(f"unexpected limit {_js_str(limit)}") from exc
        if n > 0:
            rows = rows[:n]
    return rows


async def _op_exists(ctx: NodeContext, tbl: _Table, params: Any, index: int, wanted: bool) -> bool:
    # The condition field is hidden for these two operations, so every condition is "equals".
    kind, filters = _node_filters(params, tbl, force_eq=True)
    return bool(await _select(ctx, tbl, _service_filters(kind, filters, tbl))) == wanted


def _dry_run_rows(before: dict[str, Any] | None, after: dict[str, Any] | None) -> list[dict[str, Any]]:
    template = before if before is not None else after
    null_row = {"id": None, "createdAt": None, "updatedAt": None, **{k: None for k in (template or {})}}
    return [{**(before if before is not None else null_row), "dryRunState": "before"},
            {**(after if after is not None else null_row), "dryRunState": "after"}]


async def _prepared_update(ctx: NodeContext, tbl: _Table, params: Any, index: int, item: Item):
    """The shared start of update and upsert: row data and filter, validated like the table service does."""
    row = _get_add_row(params, item, index)
    kind, filters = _node_filters(params, tbl)
    if not filters:
        raise _DtError("At least one condition is required")
    if not tbl.columns:
        raise _validation("No columns found for this data table or data table not found")
    if not row:
        raise _validation("Data columns must not be empty")
    data = _coerce_row(row, tbl)
    return data, _service_filters(kind, filters, tbl)


async def _update_rows(ctx: NodeContext, tbl: _Table, data: dict[str, Any], fs: _FilterSet, dry_run: bool) -> list[dict[str, Any]]:
    matched = await _select(ctx, tbl, fs)
    changes = _stored(data, tbl)
    if dry_run:
        stamp = _iso_ms(now())
        return [r for original in matched for r in _dry_run_rows(original, {**original, **changes, "updatedAt": stamp})]
    if not matched:
        return []
    rows = await asyncio.to_thread(ctx.services.store.dt_update, tbl.id, [r["id"] for r in matched], changes)
    return [_present(r, tbl) for r in rows]


async def _insert_rows(ctx: NodeContext, tbl: _Table, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Insert already coerced rows; columns that are not given are NULL."""
    full = [{name: _to_storage(row.get(name), ctype) for name, ctype in tbl.columns} for row in rows]

    def run() -> list[dict[str, Any]]:
        store: Store = ctx.services.store
        return [store.dt_insert(tbl.id, r) for r in full]

    return [_present(r, tbl) for r in await asyncio.to_thread(run)]


async def _op_update(ctx: NodeContext, tbl: _Table, params: Any, index: int, item: Item) -> list[dict[str, Any]]:
    dry_run = _dry_run(params)
    data, fs = await _prepared_update(ctx, tbl, params, index, item)
    return await _update_rows(ctx, tbl, data, fs, dry_run)


async def _op_upsert(ctx: NodeContext, tbl: _Table, params: Any, index: int, item: Item) -> list[dict[str, Any]]:
    dry_run = _dry_run(params)
    data, fs = await _prepared_update(ctx, tbl, params, index, item)
    updated = await _update_rows(ctx, tbl, data, fs, dry_run)
    if updated:
        return updated
    if dry_run:
        stamp = _iso_ms(now())
        return _dry_run_rows(None, {"id": 0, "createdAt": stamp, "updatedAt": stamp, **_stored(data, tbl)})
    return await _insert_rows(ctx, tbl, [data])


async def _op_delete(ctx: NodeContext, tbl: _Table, params: Any, index: int) -> list[dict[str, Any]]:
    dry_run = _dry_run(params)
    kind, filters = _node_filters(params, tbl)
    if not filters:
        raise _DtError("At least one condition is required")
    matched = await _select(ctx, tbl, _service_filters(kind, filters, tbl))
    if dry_run:
        return [r for row in matched for r in _dry_run_rows(row, None)]
    if matched:
        await asyncio.to_thread(ctx.services.store.dt_delete, tbl.id, [r["id"] for r in matched])
    return matched


def _dry_run(params: Any) -> bool:
    v = params.get("options.dryRun", False)
    if not isinstance(v, bool):
        raise _DtError(f"unexpected input {_dumps(v)} for boolean dryRun")
    return v


# ---------- the node ----------
_ROW_OPERATIONS = ("insert", "get", "update", "upsert", "deleteRows", "rowExists", "rowNotExists")


def _has_complex_id(ctx: NodeContext) -> bool:
    """A table id that is an expression forces insert to run per item instead of as one bulk call."""
    raw = ctx.node.parameters.get("dataTableId")
    if isinstance(raw, dict):
        raw = raw.get("value")
    return isinstance(raw, str) and "{" in raw


def _item_error(exc: Exception) -> dict[str, Any] | None:
    if isinstance(exc, _DtError) and exc.node_error:
        err: dict[str, Any] = {"name": "NodeOperationError", "message": str(exc)}
        if exc.description:
            err["description"] = exc.description
        return err
    return None


def _raise(exc: Exception) -> None:
    if isinstance(exc, _DtError):
        raise NodeError(str(exc), exc.description) from exc
    raise exc


async def _insert_bulk(ctx: NodeContext, plist: list[Any]) -> list[Item]:
    """Router "Row bulk operations": every input item becomes a row, inserted in one go."""
    items = ctx.items
    try:
        tbl = _resolve_table(ctx, plist[0])
        optimize = _truthy(plist[0].get("options.optimizeBulk", False))
        rows = [_coerce_row(_get_add_row(plist[i], items[i], i), tbl) for i in range(len(items))]
        inserted = await _insert_rows(ctx, tbl, rows)
    except (_DtError, NodeError) as exc:
        if not ctx.continue_on_fail:
            _raise(exc)
        # n8n maps the whole input items into json here, so an item's data sits one level deeper.
        err = _item_error(exc)
        return [{"json": dict(item), **({"error": err} if err else {})} for item in items]
    if optimize:
        return [{"json": {"success": True, "insertedRows": len(inserted)}}]
    return [{"json": r, "pairedItem": {"item": n}} for n, r in enumerate(inserted)]


async def _run_item(ctx: NodeContext, op: str, params: Any, item: Item, index: int) -> list[Item]:
    tbl = _resolve_table(ctx, params)
    if op == "insert":  # per item only when the table id is an expression
        row = _coerce_row(_get_add_row(params, item, index), tbl)
        inserted = await _insert_rows(ctx, tbl, [row])
        if _truthy(params.get("options.optimizeBulk", False)):
            return [{"json": {"success": True, "insertedRows": 1}, "pairedItem": {"item": index}}]
        return [{"json": r, "pairedItem": {"item": n}} for n, r in enumerate(inserted)]
    if op == "get":
        rows = await _op_get(ctx, tbl, params, index)
    elif op == "update":
        rows = await _op_update(ctx, tbl, params, index, item)
    elif op == "upsert":
        rows = await _op_upsert(ctx, tbl, params, index, item)
    elif op == "deleteRows":
        rows = await _op_delete(ctx, tbl, params, index)
    else:  # rowExists / rowNotExists pass the input item on
        keep = await _op_exists(ctx, tbl, params, index, wanted=(op == "rowExists"))
        return [{**item, "pairedItem": {"item": index}}] if keep else []
    return [{"json": r, "pairedItem": {"item": index}} for r in rows]


async def handler(ctx: NodeContext):
    items = ctx.items
    if not items:
        return [[]]
    plist = await ctx.params()
    resource = plist[0].get("resource", "row")
    operation = plist[0].get("operation", "insert")
    if resource != "row":
        raise NodeError(f"Data table resource '{resource}' is not supported by this engine (only row operations)")
    if operation not in _ROW_OPERATIONS:
        raise NodeError(f'The operation "{operation}" is not supported!')
    if operation == "insert" and not _has_complex_id(ctx):
        return [await _insert_bulk(ctx, plist)]
    out: list[Item] = []
    for i, item in enumerate(items):
        try:
            out.extend(await _run_item(ctx, operation, plist[i], item, i))
        except (_DtError, NodeError) as exc:
            if not ctx.continue_on_fail:
                _raise(exc)
            err = _item_error(exc)
            out.append({"json": item.get("json", {}), **({"error": err} if err else {})})
    return [out]


HANDLERS = {"dataTable": handler}


# ---------- reference data ----------
def seed_reference_tables_sync(store: Store, schemas: dict[str, dict[str, Any]], seeds_dir: Path,
                               table_ids: tuple[str, ...] = SEEDED_TABLES) -> dict[str, int]:
    """Load data/seeds/<tableId>.json into each table that has no rows yet. Returns {table_id: rows loaded}.

    Column values are kept as given; the store numbers the rows itself and stamps createdAt/updatedAt with the
    time of loading, so ids and timestamps differ from the n8n export while the order of the rows is the same.
    """
    loaded: dict[str, int] = {}
    for table_id in table_ids:
        schema = schemas.get(table_id)
        path = seeds_dir / f"{table_id}.json"
        if schema is None or not path.is_file():
            loaded[table_id] = 0
            continue
        rows = json.loads(path.read_text(encoding="utf-8")).get("rows", [])
        loaded[table_id] = store.dt_seed(table_id, rows, [c["name"] for c in schema["columns"]])
    return loaded


async def seed_reference_tables(services: Any) -> dict[str, int]:
    """Seed the model registry, handling profiles and catalogue into their empty tables (startup helper)."""
    return await asyncio.to_thread(
        seed_reference_tables_sync, services.store, services.schemas, Path(services.settings.seeds_dir))
