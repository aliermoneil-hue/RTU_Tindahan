"""Measure the marketplace under load (PF-01, PF-02, PF-04).

Standard library only, so it runs anywhere the project already runs:

    python scripts/load_test.py --concurrency 200 --seconds 30
    python scripts/load_test.py --url https://kallisto-1.tail69492d.ts.net --users 50

Three questions are answered by one run:

  PF-04  how many people can be browsing at the same time before requests fail
         or slow down (the SRS asks for 200)
  PF-02  how long the search and filter endpoints take (the SRS asks for 3 s)
  PF-01  the API half of a page load; the browser half is measured separately by
         fetching the deployed page and its bundle (--page)

Each virtual user is a small think-then-act loop, because a real visitor reads
the page before clicking. Weighting the scenarios is what makes the numbers mean
"a marketplace" rather than "a loop hammering one endpoint":

    browse first page     30%   the commonest thing anyone does
    browse a later page   15%
    open one listing      25%
    search                15%   PF-02
    category filter       10%   PF-02
    forum list             5%

The machine's own limits are recorded in the output header (cores, load average)
because a figure from a four-core laptop is evidence about a four-core laptop,
not about a server. That is written on purpose: a number without its hardware is
a story, not a measurement.
"""

import argparse
import json
import os
import random
import statistics
import sys
import threading
import time
import urllib.error
import urllib.request
from collections import defaultdict

HEALTH = "/health/"
BROWSE = "/api/v1/listings/?page=1"
BROWSE_SORTED = "/api/v1/listings/?page=1&ordering=-price"
SEARCH = "/api/v1/listings/?search={term}"
CATEGORY = "/api/v1/listings/?category={slug}"
FORUM = "/api/v1/forum/posts/"

SEARCH_TERMS = ["calculator", "uniform", "reviewer", "coffee", "ballpen"]
CATEGORIES = [
    "books-and-academic-materials",
    "school-supplies",
    "food-and-snacks",
    "gadgets",
]

SCENARIOS = [
    (0.30, "browse", BROWSE),
    (0.15, "browse-sorted", BROWSE_SORTED),
    (0.25, "listing", None),  # replaced by a real slug at run time
    (0.15, "search", None),
    (0.10, "category", None),
    (0.05, "forum", FORUM),
]


def fetch(base, path, timeout=30):
    """One request, timed. Returns (seconds, status, bytes)."""
    started = time.perf_counter()
    request = urllib.request.Request(base.rstrip("/") + path, method="GET")
    request.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read()
            return time.perf_counter() - started, response.status, len(body)
    except urllib.error.HTTPError as exc:
        exc.read()
        return time.perf_counter() - started, exc.code, 0
    except Exception:  # noqa: BLE001 - a dead socket is a failed request
        return time.perf_counter() - started, 0, 0


def pick_scenario():
    roll = random.random()
    upto = 0.0
    for weight, name, path in SCENARIOS:
        upto += weight
        if roll <= upto:
            return name, path
    return SCENARIOS[0][1], SCENARIOS[0][2]


def resolve(name, path, slugs):
    if name == "listing":
        return f"/api/v1/listings/{random.choice(slugs)}/"
    if name == "search":
        return SEARCH.format(term=random.choice(SEARCH_TERMS))
    if name == "category":
        return CATEGORY.format(slug=random.choice(CATEGORIES))
    return path


class Recorder:
    def __init__(self):
        self.lock = threading.Lock()
        self.latencies = defaultdict(list)
        self.errors = defaultdict(int)
        self.count = 0

    def add(self, name, seconds, status):
        with self.lock:
            self.latencies[name].append(seconds)
            self.count += 1
            if status != 200:
                self.errors[name] += 1


def user_loop(base, slugs, seconds, recorder, think):
    deadline = time.perf_counter() + seconds
    while time.perf_counter() < deadline:
        name, path = pick_scenario()
        target = resolve(name, path, slugs)
        elapsed, status, _size = fetch(base, target)
        recorder.add(name, elapsed, status)
        # A visitor reads what came back before clicking again.
        time.sleep(random.uniform(think * 0.5, think * 1.5))


def percentile(values, pct):
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, int(round((pct / 100) * len(ordered) + 0.5)) - 1)
    return ordered[max(0, index)]


def page_timing(base, runs):
    """PF-01's browser half: the deployed page and its bundle, fetched cold."""
    results = []
    for _ in range(runs):
        started = time.perf_counter()
        codes = []
        html, status, _ = fetch(base, "/", timeout=30)
        codes.append(status)
        elapsed = html
        try:
            request = urllib.request.Request(base.rstrip("/") + "/")
            with urllib.request.urlopen(request, timeout=30) as response:
                text = response.read().decode("utf-8", "replace")
            import re

            match = re.search(r'src="(/assets/index-[^"]+\.js)"', text)
            if match:
                js_time, js_status, _ = fetch(base, match.group(1), timeout=30)
                codes.append(js_status)
                elapsed += js_time
        except Exception:  # noqa: BLE001
            pass
        results.append((time.perf_counter() - started, codes))
    return results


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--users", "--concurrency", dest="users", type=int, default=50)
    parser.add_argument("--seconds", type=int, default=20)
    parser.add_argument("--think", type=float, default=0.4, help="seconds between actions")
    parser.add_argument("--page", type=int, default=0, help="also time N cold page loads")
    parser.add_argument("--json", default="", help="write the raw numbers here")
    args = parser.parse_args(argv)

    listing = json.loads(
        urllib.request.urlopen(args.url.rstrip("/") + BROWSE, timeout=30).read()
    )
    slugs = [row["slug"] for row in listing["results"]] or ["calculator-2"]

    cores = os.cpu_count() or 1
    load = os.getloadavg()[0] if hasattr(os, "getloadavg") else 0.0
    print(f"target      {args.url}")
    print(f"hardware    {cores} cores, load average {load:.2f} at start")
    print(f"load        {args.users} virtual users, {args.seconds}s, think {args.think}s")
    print()

    recorder = Recorder()
    threads = [
        threading.Thread(
            target=user_loop,
            args=(args.url, slugs, args.seconds, recorder, args.think),
            daemon=True,
        )
        for _ in range(args.users)
    ]
    started = time.perf_counter()
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    wall = time.perf_counter() - started

    every = [s for values in recorder.latencies.values() for s in values]
    failures = sum(recorder.errors.values())
    print(f"requests    {recorder.count} in {wall:.1f}s  ({recorder.count / wall:.1f} req/s)")
    print(f"failures    {failures}  ({failures / max(1, recorder.count) * 100:.2f}%)")
    print()
    print(f"{'scenario':14} {'n':>6} {'p50':>7} {'p95':>7} {'p99':>7} {'max':>7}  fails")
    for name in sorted(recorder.latencies):
        values = recorder.latencies[name]
        print(
            f"{name:14} {len(values):>6} "
            f"{percentile(values, 50):>7.3f} {percentile(values, 95):>7.3f} "
            f"{percentile(values, 99):>7.3f} {max(values):>7.3f}  {recorder.errors[name]}"
        )
    print()
    print(
        f"overall     p50 {percentile(every, 50):.3f}s  "
        f"p95 {percentile(every, 95):.3f}s  p99 {percentile(every, 99):.3f}s  "
        f"mean {statistics.mean(every):.3f}s"
    )

    page_rows = []
    if args.page:
        print()
        page_rows = page_timing(args.url, args.page)
        times = [row[0] for row in page_rows]
        ok = [row for row in page_rows if all(code == 200 for code in row[1])]
        print(
            f"page load   {len(ok)}/{len(page_rows)} clean, "
            f"p50 {percentile(times, 50):.2f}s  p95 {percentile(times, 95):.2f}s  "
            f"max {max(times):.2f}s"
        )

    if args.json:
        payload = {
            "target": args.url,
            "cores": cores,
            "users": args.users,
            "seconds": args.seconds,
            "requests": recorder.count,
            "wall_seconds": round(wall, 2),
            "failures": failures,
            "overall": {
                "p50": round(percentile(every, 50), 4),
                "p95": round(percentile(every, 95), 4),
                "p99": round(percentile(every, 99), 4),
                "mean": round(statistics.mean(every), 4),
            },
            "scenarios": {
                name: {
                    "n": len(values),
                    "p50": round(percentile(values, 50), 4),
                    "p95": round(percentile(values, 95), 4),
                    "p99": round(percentile(values, 99), 4),
                    "failures": recorder.errors[name],
                }
                for name, values in recorder.latencies.items()
            },
            "page_loads": [round(row[0], 3) for row in page_rows],
        }
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
        print(f"written     {args.json}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
