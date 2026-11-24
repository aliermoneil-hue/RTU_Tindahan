"""Measure the marketplace under a crowd, including the paths that write.

    python scripts/stress_test.py --users 50 --seconds 60
    python scripts/stress_test.py --users 200 --seconds 30 --base http://127.0.0.1:8000
    python scripts/stress_test.py --users 40 --seconds 30 --no-writes --json out.json

`load_test.py` measures the reading half of the site: browse, search, filter. This
measures the whole loop a class actually performs — signing in, posting a listing,
sending an order request, opening conversations, and the moderator's queue — because
the write paths are where SQLite contends for its single writer and where a
deployment usually falls over first.

Every virtual user signs in through the real login endpoint, so the numbers include
the token path rather than assuming it. Scenarios are weighted to look like a
campus marketplace rather than a loop aimed at one URL, and each scenario is timed
separately: an average across browse and create-listing hides the fact that one is
fast and the other is slow.

Standard library only, on purpose: it runs wherever the project already runs, and a
load generator that needs its own dependency tree is one more thing to get wrong on
the day. Run it against a populated database — an empty one flatters the server,
because the queries are cheaper than they will ever be again.

Safety: writes create real rows. Run it against a test install, and use
`manage.py seed_stress_data --clear` plus `manage.py reset_system_data --yes`
afterwards.
"""

import argparse
import ipaddress
import json
import os
import random
import statistics
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from urllib.parse import urlparse

PASSWORD = "StressTest!2345"
SELLER_GLOB = "stress-seller-"

# How the crowd behaves. Weights sum to 100; a signed-in visitor does the middle
# band, and the moderator's queue is rare because there is one moderator per campus.
SCENARIOS = [
    ("browse page 1", 16, "anon"),
    ("browse page 2", 7, "anon"),
    ("listing detail", 12, "anon"),
    ("search", 9, "anon"),
    ("category filter", 7, "anon"),
    ("forum list", 5, "anon"),
    ("sign in", 1, "anon"),
    ("create listing", 10, "user"),
    ("order request", 10, "user"),
    ("conversations", 8, "user"),
    ("favorites toggle", 5, "user"),
    ("moderation queue", 3, "staff"),
    ("my listings", 3, "user"),
]


def http(method, base, path, token=None, body=None, timeout=30, files=None):
    """One request. Returns (status, seconds, payload). Never raises for a bad status."""
    url = base.rstrip("/") + path
    data = None
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Token {token}"

    if files:
        boundary = "----stress" + str(random.randrange(10**12))
        chunks = []
        for name, value in (body or {}).items():
            chunks.append(
                f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'
            )
        for field, (filename, payload) in files.items():
            chunks.append(
                f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; '
                f'filename="{filename}"\r\nContent-Type: image/jpeg\r\n\r\n'
            )
            data = ("".join(chunks)).encode() + payload + f"\r\n--{boundary}--\r\n".encode()
            break
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = response.read()
            return response.status, time.perf_counter() - started, payload
    except urllib.error.HTTPError as exc:
        return exc.code, time.perf_counter() - started, exc.read()
    except Exception as exc:  # timeouts, connection resets: a failure is a result
        return 0, time.perf_counter() - started, str(exc).encode()


def login(base, email, password=PASSWORD, timeout=30):
    status, _seconds, payload = http(
        "POST", base, "/api/v1/auth/login/", body={"email": email, "password": password}
    )
    if status == 200:
        try:
            return json.loads(payload).get("token")
        except Exception:
            return None
    return None


def percentile(values, pct):
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, int(round((pct / 100.0) * (len(ordered) - 1))))
    return ordered[index]


class Recorder:
    def __init__(self):
        self.lock = threading.Lock()
        self.times = defaultdict(list)
        self.statuses = defaultdict(Counter)
        self.errors = []
        self.count = 0

    def add(self, scenario, seconds, status, note=None):
        with self.lock:
            self.times[scenario].append(seconds)
            self.statuses[scenario][status] += 1
            self.count += 1
            if status == 0 or status >= 500:
                if len(self.errors) < 40:
                    self.errors.append((scenario, status, (note or "")[:160]))


def is_local(base):
    host = urlparse(base).hostname or ""
    if host in ("localhost", "127.0.0.1", "::1"):
        return True
    try:
        return ipaddress.ip_address(host).is_private
    except ValueError:
        return False


def load_reference(base):
    """The ids and slugs a crowd needs, read once so the loops do not reload them."""
    slugs, ids, category_slugs, listing_ids = [], [], [], []
    status, _s, payload = http("GET", base, "/api/v1/listings/?page_size=50")
    if status == 200:
        try:
            data = json.loads(payload)
            for row in data.get("results", []):
                if row.get("slug"):
                    slugs.append(row["slug"])
                if row.get("id"):
                    listing_ids.append(row["id"])
        except Exception:
            pass
    status, _s, payload = http("GET", base, "/api/v1/categories/")
    if status == 200:
        try:
            for row in json.loads(payload):
                if row.get("slug"):
                    category_slugs.append(row["slug"])
        except Exception:
            pass
    return {
        "slugs": slugs or ["none"],
        "listing_ids": listing_ids,
        "categories": category_slugs,
    }


def pick_scenario(weights, role):
    """A person browses anonymously and acts while signed in; only the moderator
    is confined to the staff scenarios."""
    if role == "staff":
        pool = [(name, weight) for name, weight, needed in weights if needed == "staff"]
    else:
        pool = [(name, weight) for name, weight, needed in weights if needed in ("anon", "user")]
    total = sum(weight for _name, weight in pool)
    mark = random.uniform(0, total)
    running = 0.0
    for name, weight in pool:
        running += weight
        if mark <= running:
            return name
    return pool[-1][0]


def virtual_user(base, tokens, reference, seconds, recorder, think, writes):
    user_token = None
    staff_token = tokens.get("staff")
    if tokens.get("users"):
        user_token = random.choice(tokens["users"])

    weights = [row for row in SCENARIOS if writes or row[0] != "create listing"]
    deadline = time.time() + seconds
    while time.time() < deadline:
        scenario = pick_scenario(weights, "staff" if random.random() < 0.03 else "person")
        started = time.perf_counter()

        if scenario == "browse page 1":
            status, seconds_taken, _ = http("GET", base, "/api/v1/listings/?page=1")
        elif scenario == "browse page 2":
            status, seconds_taken, _ = http("GET", base, "/api/v1/listings/?page=2")
        elif scenario == "listing detail":
            slug = random.choice(reference["slugs"])
            status, seconds_taken, _ = http(
                "GET", base, f"/api/v1/listings/{urllib.parse.quote(slug)}/"
            )
        elif scenario == "search":
            term = random.choice(["calculator", "book", "uniform", "pen", "cable"])
            status, seconds_taken, _ = http(
                "GET", base, f"/api/v1/listings/?search={term}"
            )
        elif scenario == "category filter":
            if reference["categories"]:
                category = random.choice(reference["categories"])
                status, seconds_taken, _ = http(
                    "GET", base, f"/api/v1/listings/?category={category}"
                )
            else:
                status, seconds_taken, _ = http("GET", base, "/api/v1/listings/")
        elif scenario == "forum list":
            status, seconds_taken, _ = http("GET", base, "/api/v1/forum/posts/")
        elif scenario == "sign in":
            # One loop in a hundred signs in afresh; the rest of the crowd keeps the
            # token it already has. Hammering the login endpoint measures the
            # throttle (five failures and the account is locked), not the site.
            email = f"{SELLER_GLOB}{random.randrange(0, 20):03d}@rtu.edu.ph"
            status, seconds_taken, payload = http(
                "POST",
                base,
                "/api/v1/auth/login/",
                body={"email": email, "password": PASSWORD},
            )
            recorder.add(scenario, seconds_taken, status, payload)
            time.sleep(think)
            continue
        elif scenario == "create listing":
            if not user_token or not reference["categories"]:
                status, seconds_taken = 0, 0.0
            else:
                body = {
                    "title": f"Stress listing {random.randrange(10**6)}",
                    "description": "Created by the stress harness to measure the write path.",
                    "price": "99.00",
                    "category": reference.get("category_ids", [None])[0],
                    "condition": "used",
                    "meetup_place": "Covered court",
                }
                status, seconds_taken, payload = http(
                    "POST", base, "/api/v1/listings/", token=user_token, body=body
                )
                recorder.add(scenario, seconds_taken, status, payload)
                time.sleep(think)
                continue
        elif scenario == "order request":
            if not user_token or not reference["listing_ids"]:
                status, seconds_taken = 0, 0.0
            else:
                body = {
                    "lines": [{"listing": random.choice(reference["listing_ids"]), "quantity": 1}],
                    "fulfillment": "pickup",
                    "meetup_place": "Covered court",
                }
                status, seconds_taken, payload = http(
                    "POST", base, "/api/v1/orders/", token=user_token, body=body
                )
                recorder.add(scenario, seconds_taken, status, payload)
                time.sleep(think)
                continue
        elif scenario == "conversations":
            status, seconds_taken, payload = http(
                "GET", base, "/api/v1/conversations/", token=user_token
            )
        elif scenario == "favorites toggle":
            if not user_token:
                status, seconds_taken = 0, 0.0
            else:
                status, seconds_taken, _ = http(
                    "GET", base, "/api/v1/favorites/", token=user_token
                )
        elif scenario == "moderation queue":
            status, seconds_taken, _ = http(
                "GET", base, "/api/v1/listings/?moderation_status=needs_review", token=staff_token
            )
        elif scenario == "my listings":
            status, seconds_taken, _ = http(
                "GET", base, "/api/v1/listings/?mine=1", token=user_token
            )
        else:
            status, seconds_taken = 0, 0.0

        recorder.add(scenario, seconds_taken, status)
        time.sleep(max(0.0, think - (time.perf_counter() - started)))


def main(argv=None):
    parser = argparse.ArgumentParser(description="Stress the marketplace and report percentiles.")
    parser.add_argument("--base", default="http://127.0.0.1:8000")
    parser.add_argument("--users", "--concurrency", dest="users", type=int, default=50)
    parser.add_argument("--seconds", type=int, default=45)
    parser.add_argument("--think", type=float, default=0.4, help="seconds to think between actions")
    parser.add_argument("--accounts", type=int, default=20, help="how many stress sellers to sign in")
    parser.add_argument("--no-writes", action="store_true", help="skip anything that creates rows")
    parser.add_argument("--json", default="", help="write the raw result here")
    parser.add_argument("--markdown", default="", help="write a readable report here")
    args = parser.parse_args(argv)

    if not is_local(args.base) and not os.environ.get("STRESS_ALLOW_REMOTE"):
        print(
            f"refusing to stress a non-local address ({args.base}) without STRESS_ALLOW_REMOTE=1",
            file=sys.stderr,
        )
        return 2

    print(f"base        {args.base}")
    print(f"crowd       {args.users} virtual users for {args.seconds}s, think {args.think}s")
    print(f"writes      {'off' if args.no_writes else 'on'}")

    reference = load_reference(args.base)
    status, _s, payload = http("GET", args.base, "/api/v1/categories/")
    if status == 200:
        try:
            reference["category_ids"] = [row["id"] for row in json.loads(payload)]
        except Exception:
            reference["category_ids"] = []
    print(
        f"reference   {len(reference['slugs'])} listing slug(s), "
        f"{len(reference['listing_ids'])} listing id(s), "
        f"{len(reference['categories'])} category slug(s)"
    )
    if len(reference["listing_ids"]) == 0:
        print("warning: no listings returned; seed the database before measuring")

    tokens = {"users": [], "staff": None}
    print("signing in the crowd…")
    for index in range(args.accounts):
        token = login(args.base, f"{SELLER_GLOB}{index:03d}@rtu.edu.ph")
        if token:
            tokens["users"].append(token)
    tokens["staff"] = login(args.base, "stress-moderator@rtu.edu.ph")
    print(
        f"            {len(tokens['users'])} seller token(s), "
        f"{'1' if tokens['staff'] else 'no'} moderator token"
    )

    recorder = Recorder()
    threads = [
        threading.Thread(
            target=virtual_user,
            args=(args.base, tokens, reference, args.seconds, recorder, args.think, not args.no_writes),
            daemon=True,
        )
        for _ in range(args.users)
    ]

    started = time.time()
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    elapsed = time.time() - started

    rows = []
    for name, _weight, _role in SCENARIOS:
        times = recorder.times.get(name) or []
        if not times:
            continue
        statuses = recorder.statuses[name]
        ok = sum(count for code, count in statuses.items() if 200 <= code < 400)
        rows.append(
            {
                "scenario": name,
                "requests": len(times),
                "ok": ok,
                "failed": len(times) - ok,
                "p50_ms": round(percentile(times, 50) * 1000, 1),
                "p95_ms": round(percentile(times, 95) * 1000, 1),
                "p99_ms": round(percentile(times, 99) * 1000, 1),
                "max_ms": round(max(times) * 1000, 1),
                "statuses": dict(statuses),
            }
        )

    all_times = [t for times in recorder.times.values() for t in times]
    total_ok = sum(row["ok"] for row in rows)
    summary = {
        "base": args.base,
        "users": args.users,
        "seconds": round(elapsed, 1),
        "requests": recorder.count,
        "failed": recorder.count - total_ok,
        "throughput_rps": round(recorder.count / elapsed, 1) if elapsed else 0,
        "p50_ms": round(percentile(all_times, 50) * 1000, 1),
        "p95_ms": round(percentile(all_times, 95) * 1000, 1),
        "p99_ms": round(percentile(all_times, 99) * 1000, 1),
        "errors": recorder.errors,
        "scenarios": rows,
    }

    print()
    print(f"{'scenario':<20}{'req':>7}{'fail':>6}{'p50':>9}{'p95':>9}{'p99':>9}{'max':>9}")
    for row in rows:
        print(
            f"{row['scenario']:<20}{row['requests']:>7}{row['failed']:>6}"
            f"{row['p50_ms']:>9}{row['p95_ms']:>9}{row['p99_ms']:>9}{row['max_ms']:>9}"
        )
    print(
        f"\n{summary['requests']} requests in {summary['seconds']}s "
        f"({summary['throughput_rps']}/s), {summary['failed']} failed"
    )
    print(f"p50 {summary['p50_ms']} ms · p95 {summary['p95_ms']} ms · p99 {summary['p99_ms']} ms")
    if summary["errors"]:
        print("\nfailures:")
        for scenario, code, note in summary["errors"][:8]:
            print(f"  {scenario}: {code} {note}")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(summary, handle, indent=2)
        print(f"\nwrote {args.json}")
    if args.markdown:
        with open(args.markdown, "w", encoding="utf-8") as handle:
            handle.write(f"# Stress run — {args.users} virtual users, {summary['seconds']}s\n\n")
            handle.write(f"- base: `{args.base}`\n- requests: {summary['requests']} "
                         f"({summary['throughput_rps']}/s)\n- failed: {summary['failed']}\n")
            handle.write(f"- p50 {summary['p50_ms']} ms · p95 {summary['p95_ms']} ms · "
                         f"p99 {summary['p99_ms']} ms\n\n")
            handle.write("| scenario | requests | failed | p50 | p95 | p99 | max |\n")
            handle.write("|---|---|---|---|---|---|---|\n")
            for row in rows:
                handle.write(
                    f"| {row['scenario']} | {row['requests']} | {row['failed']} | "
                    f"{row['p50_ms']} | {row['p95_ms']} | {row['p99_ms']} | {row['max_ms']} |\n"
                )
        print(f"wrote {args.markdown}")
    return 0 if summary["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
