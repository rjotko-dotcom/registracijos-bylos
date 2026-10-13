"""Nustatymai: kur saugomas Excel failas."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

APP_DIR = Path(sys.executable).parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parent.parent
SETTINGS_FILE = APP_DIR / "nustatymai.json"


def load_excel_path() -> Path:
    if os.environ.get("SASKAITOS_EXCEL"):
        return Path(os.environ["SASKAITOS_EXCEL"])
    try:
        saved = json.loads(SETTINGS_FILE.read_text(encoding="utf-8")).get("excel_path")
        if saved:
            return Path(saved)
    except (OSError, ValueError):
        pass
    return APP_DIR / "saskaitos.xlsx"


def save_excel_path(path: Path) -> None:
    try:
        SETTINGS_FILE.write_text(json.dumps({"excel_path": str(path)}, ensure_ascii=False, indent=2),
                                 encoding="utf-8")
    except OSError:
        pass  # nustatymų neišsaugojimas neturi trukdyti darbui
