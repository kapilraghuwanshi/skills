# CodePen Export Notes

CodePen's official API docs say there is no traditional public REST or GraphQL API for retrieving account data. Use page discovery and Pen export flows instead.

Official docs:

- API: https://blog.codepen.io/docs/api/
- Exporting Pens: https://blog.codepen.io/docs/pens/exporting/
- Older export details: https://blog.codepen.io/documentation/exporting-pens/
- Raw File URLs: https://blog.codepen.io/docs/live-view/raw-file-urls/

Export behavior from the docs:

- A Pen export is a `.zip` download.
- Users must be logged in and able to view the Pen to export it.
- Exported zips include `src/` with original source files.
- Exported zips include `dist/` with the last successful built output.
- Public Pens include a license; private Pens do not.
- External resources may remain external and may not be fully offline.

Implementation notes:

- Prefer exporting full zips instead of scraping raw editor content.
- Treat raw CodePen exports as immutable backups.
- Keep auth in environment variables.
- CodePen page markup can change; keep URL extraction and export URL generation centralized in the script.
