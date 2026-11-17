# docs/

Approved project documents live here so the whole team reads the same version.

Suggested contents, copied from the CapStone folder:

    docs/
    ├── SRS-RTU-Tindahan-v2.0-Complete.md   Software Requirements Specification
    ├── RTU-Tindahan-Tech-Stack.txt         Approved technology stack
    ├── SRS_Gap_Analysis.md                 Gap analysis between SRS versions
    └── diagrams/                           Figma exports, ERD, architecture

## Guides written by the team

- `EMAIL-SETUP.md` — sending verification mail: Mailtrap for local testing,
  Gmail for the deployed backend, plus troubleshooting and rotation rules.
- `AUTH-HARDENING.md` — password reset by code, token lifetime, and ending
  sessions, with the migration path for each.
- `SCREENING.md` — the content-screening boundary: provider rules, the
  deterministic stub, and the moderator queue.
- `INTEGRATION-SETUP.md` — connecting the React app to the Django API.

Rules:

- Markdown is preferred over `.docx` so changes show up in pull request diffs.
- Keep one current version of each document. Move old versions to
  `docs/archive/` rather than deleting them.
- Never put survey responses with respondent names in this repository unless
  the team has agreed it is necessary.
