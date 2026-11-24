"""Ask the running site the questions a reviewer would ask it.

    python scripts/security_sweep.py
    python scripts/security_sweep.py --base https://kallisto-1.tail69492d.ts.net

This is not a penetration test and does not pretend to be one. It is a checklist of
the things that go wrong in a student project built in a semester — an endpoint left
open to guests, one member reading another's order, a contact number in a public
payload, a password policy that exists in the settings but is never reached — run
against the deployed API so the answers are facts rather than assumptions.

Each check prints PASS, WARN or FAIL and a one-line reason. FAIL means a rule the
project states about itself is not kept; WARN means it is kept but weakly, or a
hardening header is missing. Nothing here writes to the database except through the
public endpoints, and every account it creates is tagged and removed by
`--cleanup`.
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

# AV-04: a student account must carry the student-number form, so the sweep uses
# the shape the validator accepts rather than an address it would reject.
STUDENT_A = "2024-900001@rtu.edu.ph"
STUDENT_B = "2024-900002@rtu.edu.ph"
PASSWORD = "SweepPass!2345"
STUDENT_NUMBER = re.compile(r"\b\d{4}-\d{6}\b")
PH_MOBILE = re.compile(r"(?:\+63|0)9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}")

RESULTS = []


def call(method, base, path, token=None, body=None, raw_headers=False, timeout=20):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Token {token}"
    request = urllib.request.Request(
        base.rstrip("/") + path, data=data, headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = response.read()
            if raw_headers:
                return response.status, dict(response.headers), payload
            return response.status, None, payload
    except urllib.error.HTTPError as exc:
        payload = exc.read()
        if raw_headers:
            return exc.code, dict(exc.headers), payload
        return exc.code, None, payload
    except Exception as exc:
        return 0, None, str(exc).encode()


def check(name, ok, detail, severity="FAIL"):
    RESULTS.append((name, "PASS" if ok else severity, detail))
    print(f"  {'PASS' if ok else severity:<4}  {name} — {detail}")


def login(base, email, password=PASSWORD):
    status, _h, payload = call("POST", base, "/api/v1/auth/login/", body={"email": email, "password": password})
    if status == 200:
        try:
            return json.loads(payload).get("token")
        except Exception:
            return None
    return None


def ensure_account(base, email, display):
    """Register and verify through the project's own endpoints, not the ORM."""
    status, _h, payload = call(
        "POST",
        base,
        "/api/v1/auth/register/",
        body={
            "email": email,
            "display_name": display,
            "password": PASSWORD,
            "password_confirm": PASSWORD,
            "privacy_consent": True,
            "member_type": "student",
            "college": "CICT",
            "year_level": 2,
        },
    )
    if status in (200, 201):
        return "registered"
    if status == 400 and b"already" in payload.lower():
        return "exists"
    return f"register failed ({status})"


def sweep(base):
    print(f"\nsecurity sweep against {base}\n")

    print("authentication")
    anon_paths = [
        ("GET", "/api/v1/orders/"),
        ("GET", "/api/v1/notifications/"),
        ("GET", "/api/v1/conversations/"),
        ("GET", "/api/v1/favorites/"),
        ("POST", "/api/v1/orders/"),
        ("GET", "/api/v1/auth/me/"),
        ("GET", "/api/v1/store/stock/"),
        ("GET", "/api/v1/screening-rules/"),
    ]
    open_paths = []
    for method, path in anon_paths:
        status, _h, _p = call(method, base, path, body={} if method == "POST" else None)
        if status not in (401, 403):
            open_paths.append(f"{method} {path} → {status}")
    check(
        "guests cannot reach acting endpoints",
        not open_paths,
        "all returned 401/403" if not open_paths else "; ".join(open_paths),
    )

    print("\nrole boundaries")
    token_a = login(base, STUDENT_A)
    token_b = login(base, STUDENT_B)
    if not token_a or not token_b:
        print("  SKIP  cannot sign in the sweep accounts; run with --setup first")
        return
    staff_only = [
        ("GET", "/api/v1/screening-rules/"),
        ("POST", "/api/v1/screening-rules/"),
        ("GET", "/api/v1/store/stock/"),
        ("GET", "/api/v1/store/outbox/"),
        ("GET", "/api/v1/audit/"),
    ]
    leaked = []
    for method, path in staff_only:
        status, _h, _p = call(method, base, path, token=token_a, body={} if method == "POST" else None)
        # 404 is fine: it means the endpoint is not there for this account at all.
        if status not in (401, 403, 404, 405):
            leaked.append(f"{method} {path} → {status}")
    check(
        "a student cannot reach staff endpoints",
        not leaked,
        "all refused" if not leaked else "; ".join(leaked),
    )

    print("\ncross-account access (IDOR)")
    status, _h, payload = call("GET", base, "/api/v1/orders/", token=token_a)
    order_a = None
    if status == 200:
        try:
            rows = json.loads(payload)
            rows = rows.get("results", rows) if isinstance(rows, dict) else rows
            order_a = rows[0] if rows else None
        except Exception:
            order_a = None
    if order_a:
        status, _h, payload = call(
            "GET", base, f"/api/v1/orders/{order_a.get('id')}/", token=token_b
        )
        check(
            "another student cannot open an order that is not theirs",
            status in (403, 404),
            f"GET as the other student → {status}",
        )
        check(
            "the order hides the other side's contact until acceptance",
            not order_a.get("seller_contact") and not order_a.get("buyer_contact")
            or order_a.get("status") not in ("requested", "declined", "cancelled"),
            f"status={order_a.get('status')}, seller_contact={order_a.get('seller_contact')!r}",
            severity="WARN",
        )
    else:
        print("  SKIP  no order exists to test cross-account access")

    status, _h, payload = call("GET", base, "/api/v1/conversations/", token=token_a)
    conversation_id = None
    if status == 200:
        try:
            rows = json.loads(payload)
            rows = rows.get("results", rows) if isinstance(rows, dict) else rows
            conversation_id = rows[0]["id"] if rows else None
        except Exception:
            conversation_id = None
    if conversation_id:
        status, _h, _p = call(
            "GET", base, f"/api/v1/conversations/{conversation_id}/", token=token_b
        )
        check(
            "another student cannot read a conversation that is not theirs",
            status in (403, 404),
            f"GET as the other student → {status}",
        )
    else:
        print("  SKIP  no conversation exists to test")

    print("\nwhat a guest can see")
    status, _h, payload = call("GET", base, "/api/v1/listings/?page_size=3")
    public = payload.decode("utf-8", "replace")
    student_numbers = sorted(set(STUDENT_NUMBER.findall(public)))
    check(
        "public listings do not leak student numbers",
        not student_numbers,
        "none found" if not student_numbers else f"found {student_numbers[:3]}",
    )
    mobiles = sorted(set(PH_MOBILE.findall(public)))
    check(
        "public listings do not leak mobile numbers",
        not mobiles,
        "none found" if not mobiles else f"found {mobiles[:3]}",
    )

    print("\naccount policy")
    status, _h, payload = call(
        "POST",
        base,
        "/api/v1/auth/register/",
        body={
            "email": "2024-900003@rtu.edu.ph",
            "display_name": "Weak",
            "password": "password",
            "password_confirm": "password",
            "privacy_consent": True,
            "member_type": "student",
            "college": "CICT",
            "year_level": 2,
        },
    )
    check(
        "a weak password is refused",
        status == 400,
        f"register with 'password' → {status}",
    )

    status, _h, payload = call(
        "POST", base, "/api/v1/auth/login/", body={"email": "nobody@rtu.edu.ph", "password": "x"}
    )
    body = payload.decode("utf-8", "replace").lower()
    check(
        "a failed sign-in does not say whether the account exists",
        "not found" not in body and "no account" not in body and "unknown" not in body,
        f"→ {status}: {body[:80]}",
    )

    print("\nerror handling")
    status, _h, payload = call("POST", base, "/api/v1/orders/", token=token_a, body={"lines": "nonsense"})
    body = payload.decode("utf-8", "replace")
    check(
        "a malformed request does not return a stack trace",
        "Traceback" not in body and "settings.py" not in body and ".py\"" not in body,
        f"→ {status}",
    )

    print("\ntransport and headers")
    status, headers, _p = call("GET", base, "/api/v1/listings/", raw_headers=True)
    looked = {k.lower(): v for k, v in (headers or {}).items()}
    check(
        "clickjacking is refused",
        looked.get("x-frame-options", "").upper() in ("DENY", "SAMEORIGIN"),
        f"X-Frame-Options: {looked.get('x-frame-options', 'missing')}",
        severity="WARN",
    )
    check(
        "the browser will not sniff a different content type",
        looked.get("x-content-type-options", "").lower() == "nosniff",
        f"X-Content-Type-Options: {looked.get('x-content-type-options', 'missing')}",
        severity="WARN",
    )
    check(
        "a content security policy is sent",
        "content-security-policy" in looked,
        f"Content-Security-Policy: {'present' if 'content-security-policy' in looked else 'missing'}",
        severity="WARN",
    )
    check(
        "HSTS is sent on an HTTPS origin",
        base.startswith("https://") and "strict-transport-security" in looked,
        f"Strict-Transport-Security: {looked.get('strict-transport-security', 'missing')}",
        severity="WARN",
    )
    check(
        "the API does not set a session cookie for token auth",
        "set-cookie" not in looked,
        f"Set-Cookie: {looked.get('set-cookie', 'none')}",
        severity="WARN",
    )

    print("\nrate limiting")
    # A throwaway address on purpose: this check locks an account for fifteen
    # minutes, and locking the account the rest of the sweep signs in with would
    # make every later check skip.
    codes = []
    for _ in range(7):
        status, _h, _p = call(
            "POST",
            base,
            "/api/v1/auth/login/",
            body={"email": "2024-900099@rtu.edu.ph", "password": "wrong-password"},
        )
        codes.append(status)
    check(
        "repeated wrong passwords are throttled or locked",
        any(code in (423, 429) for code in codes) or codes.count(401) < 7,
        f"statuses {codes}",
        severity="WARN",
    )


def main(argv=None):
    parser = argparse.ArgumentParser(description="Check the deployed site against its own claims.")
    parser.add_argument("--base", default="http://127.0.0.1:8000")
    parser.add_argument("--setup", action="store_true", help="create the sweep accounts first")
    parser.add_argument("--cleanup", action="store_true", help="remove the sweep accounts")
    args = parser.parse_args(argv)

    if args.setup:
        # Registration needs the 6-digit code that goes to a real RTU inbox, which
        # this script cannot read. Create the two accounts on the server instead:
        print("run this on the server, then re-run the sweep:\n")
        print(
            "  cd ~/RTU_Tindahan/backend && .venv/bin/python manage.py shell -c \"\n"
            "    from django.utils import timezone\n"
            "    from apps.accounts.models import User, College\n"
            "    c = College.objects.first()\n"
            f"    for email, name in (('{STUDENT_A}','Sweep A'), ('{STUDENT_B}','Sweep B')):\n"
            "        u,_ = User.objects.get_or_create(email=email, defaults={'display_name': name})\n"
            "        u.role='user'; u.member_type='student'; u.college=c; u.year_level=2\n"
            "        u.status='active'; u.is_active=True; u.verified_at=timezone.now()\n"
            f"        u.set_password('{PASSWORD}'); u.save()\n"
            "        print('ready', email)\n"
            '  "'
        )
        return 0

    if args.cleanup:
        print("remove the sweep accounts with: manage.py shell -c \"User.objects.filter(email__startswith='2024-90000').delete()\"")
        return 0

    sweep(args.base)

    failed = [row for row in RESULTS if row[1] == "FAIL"]
    warned = [row for row in RESULTS if row[1] == "WARN"]
    print(f"\n{len(RESULTS)} checks: {len(RESULTS) - len(failed) - len(warned)} pass, "
          f"{len(warned)} warn, {len(failed)} fail")
    if failed:
        print("\nto fix:")
        for name, _state, detail in failed:
            print(f"  - {name}: {detail}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
