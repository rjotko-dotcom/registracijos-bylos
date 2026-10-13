"""Sąskaitos -> Excel mini programėlė (visiškai offline).

Naudojimas:
  * paleisti be argumentų – atsidaro langas, į kurį galima įmesti (drag & drop)
    PDF failus arba juos pasirinkti mygtuku;
  * python app.py failas1.pdf failas2.pdf ... – apdoroja be lango (CLI);
  * nutempti PDF ant „paleisti.bat“ – tas pats kaip CLI;
  * nutempti PDF ant Saskaitos.exe – atsidaro langas ir failai iškart apdorojami.
"""

from __future__ import annotations

import os
import sys

from saskaitos.excel import ExcelLockedError
from saskaitos.processing import process_files

ICONS = {"ok": "✔", "warning": "⚠", "duplicate": "↺", "error": "✖"}


def run_cli(paths: list[str]) -> int:
    from saskaitos.settings import load_excel_path

    excel = load_excel_path()
    try:
        results = process_files(paths, excel)
    except ExcelLockedError as exc:
        print(f"✖ {exc}")
        return 2
    for r in results:
        print(f"{ICONS[r.status]} {r.file}: {r.message}")
    print(f"\nExcel: {excel}")
    return 1 if any(r.status == "error" for r in results) else 0


if __name__ == "__main__":
    # .exe neturi konsolės – failai, nutempti ant jo, apdorojami lange.
    if len(sys.argv) > 1 and not getattr(sys, "frozen", False):
        code = run_cli(sys.argv[1:])
        if os.environ.get("SASKAITOS_PAUSE"):
            input("\nSpauskite Enter...")
        sys.exit(code)

    from saskaitos.gui import run

    run(sys.argv[1:])
