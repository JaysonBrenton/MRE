#!/usr/bin/env python3
"""
One-off: pull all public JSON the Everlaps UI can load for a single event.
Uses POST + application/json as the site does (see /api/frontend/event, /api/res).
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

BASE = "https://everlaps.com"


def post_json(path: str) -> dict | list:
    url = f"{BASE}{path}" if path.startswith("/") else f"{BASE}/{path}"
    req = urllib.request.Request(
        url,
        method="POST",
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        data=b"{}",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        body = r.read().decode("utf-8")
    return json.loads(body)


def collect_result_paths(obj, out: set[str]) -> None:
    if isinstance(obj, dict):
        if "path" in obj and obj["path"] is not None:
            p = obj["path"]
            if isinstance(p, (int, float)):
                out.add(str(int(p)))
            else:
                out.add(str(p))
        for v in obj.values():
            collect_result_paths(v, out)
    elif isinstance(obj, list):
        for x in obj:
            collect_result_paths(x, out)


def collect_driver_ids(obj, out: set[int]) -> None:
    if isinstance(obj, dict):
        if "driverid" in obj and isinstance(obj["driverid"], int):
            out.add(obj["driverid"])
        for v in obj.values():
            collect_driver_ids(v, out)
    elif isinstance(obj, list):
        for x in obj:
            collect_driver_ids(x, out)


def path_to_key(path: str) -> str:
    return path.replace("/", "_")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("event_id", type=int)
    p.add_argument("-l", "--locale", default="en")
    p.add_argument("-o", "--output", required=True, help="Write combined JSON here")
    p.add_argument("--delay", type=float, default=0.15, help="Seconds between requests")
    args = p.parse_args()
    eid = args.event_id
    loc = args.locale

    dump: dict = {
        "meta": {
            "eventUrl": f"{BASE}/ev/{eid}",
            "source": "undocumented Everlaps POST APIs",
        },
        "frontend_event": None,
        "res_event": None,
        "res_by_path": {},
        "res_driver_detail": {},
        "errors": [],
    }

    def safe(label: str, fn):
        try:
            return fn()
        except urllib.error.HTTPError as ex:
            raw = ex.read().decode("utf-8", errors="replace")[:2000]
            dump["errors"].append({"step": label, "error": str(ex), "body": raw})
        except Exception as ex:
            dump["errors"].append({"step": label, "error": repr(ex)})
        return None

    dump["frontend_event"] = safe("frontend_event", lambda: post_json(f"/api/frontend/event/{eid}"))
    time.sleep(args.delay)

    dump["res_event"] = safe("res_event", lambda: post_json(f"/api/res/{eid}?l={loc}"))
    time.sleep(args.delay)

    paths: set[str] = set()
    if isinstance(dump["res_event"], dict) and "races" in dump["res_event"]:
        collect_result_paths(dump["res_event"]["races"], paths)

    sorted_paths = sorted(paths, key=lambda s: (len(s.split("/")), s))

    for path in sorted_paths:
        key = path_to_key(path)
        url_path = f"/api/res/{eid}/{path}?l={loc}"
        dump["res_by_path"][key] = safe(f"path:{path}", lambda u=url_path: post_json(u))
        time.sleep(args.delay)

    # Driver detail is scoped to a race id: /api/res/{event}/{raceId}/d={driverId}
    drivers_by_race: dict[int, set[int]] = {}
    if isinstance(dump["res_event"], dict) and dump["res_event"].get("races"):
        for race in dump["res_event"]["races"]:
            rid = race.get("id")
            if rid is None:
                continue
            rk = path_to_key(str(rid))
            payload = dump["res_by_path"].get(rk)
            if payload is None:
                continue
            ids: set[int] = set()
            collect_driver_ids(payload, ids)
            if ids:
                drivers_by_race[int(rid)] = ids

    for rid, dids in sorted(drivers_by_race.items()):
        for did in sorted(dids):
            key = f"{rid}_{did}"
            dump["res_driver_detail"][key] = safe(
                f"driver:race{rid}:id{did}",
                lambda: post_json(f"/api/res/{eid}/{rid}/d={did}?l={loc}"),
            )
            time.sleep(args.delay)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(dump, f, ensure_ascii=False, indent=2)

    n_paths = len([v for v in dump["res_by_path"].values() if v is not None])
    n_drv = len([v for v in dump["res_driver_detail"].values() if v is not None])
    total_d = sum(len(s) for s in drivers_by_race.values())
    print(
        f"Wrote {args.output} — res paths ok: {n_paths}/{len(sorted_paths)}, "
        f"driver fetches ok: {n_drv}/{total_d}, errors: {len(dump['errors'])}",
        file=sys.stderr,
    )
    return 0 if not dump["errors"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
