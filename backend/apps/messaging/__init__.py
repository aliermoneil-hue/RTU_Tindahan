"""Messages between a buyer and a seller.

The prototype kept conversations in the browser, so a reply never crossed to
the other person. This app is the server-side counterpart: one conversation per
buyer/seller pair (optionally about a listing), messages inside it, and a read
mark so each side can see what is new.

    GET  /api/v1/conversations/                 mine, with their messages
    POST /api/v1/conversations/                 open (or find) one
    GET  /api/v1/conversations/<id>/
    POST /api/v1/conversations/<id>/messages/   say something
    POST /api/v1/conversations/<id>/read/       mark the other side's messages read
"""
