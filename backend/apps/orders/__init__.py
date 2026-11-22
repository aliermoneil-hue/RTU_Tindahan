"""Orders between students.

The Official Store has had a server-side ticket since apps/store; this app is
its counterpart for every other seller. A request used to be written into the
buyer's own browser, so the seller never saw it — the whole point of this app
is that both sides read the same row.

    POST   /api/v1/orders/                     a buyer asks one seller
    GET    /api/v1/orders/                     mine: bought and sold
    GET    /api/v1/orders/<reference>/
    POST   /api/v1/orders/<reference>/transition/   accept, decline, complete, cancel
"""
