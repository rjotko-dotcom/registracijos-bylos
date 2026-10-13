"""Duomenų įrašymas į Excel (.xlsx)."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill

from .parser import Invoice

SHEET = "Saskaitos"
HEADERS = [
    "Invoice number",
    "Invoice date",
    "VIN",
    "Kerb weight",
    "CO2",
    "Color",
    "Decor",
    "Factory code",
    "Total sum",
    "Failas",
    "Įkelta",
    "Pastabos",
]
WIDTHS = [16, 13, 21, 12, 9, 22, 40, 24, 14, 40, 18, 40]
NUMBER_FORMATS = {
    "Invoice date": "yyyy-mm-dd",
    "Kerb weight": "0",
    "CO2": "0.00",
    "Total sum": "#,##0.00",
    "Įkelta": "yyyy-mm-dd hh:mm",
}


class ExcelLockedError(Exception):
    """Excel failas atidarytas kitoje programoje ir negali būti įrašytas."""


def _new_workbook() -> Workbook:
    wb = Workbook()
    ws = wb.active
    ws.title = SHEET
    ws.append(HEADERS)
    for i, width in enumerate(WIDTHS, start=1):
        ws.column_dimensions[ws.cell(1, i).column_letter].width = width
        cell = ws.cell(1, i)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="305496")
        cell.alignment = Alignment(vertical="center")
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{ws.cell(1, len(HEADERS)).column_letter}1"
    return wb


def _open(path: Path) -> Workbook:
    if not path.exists():
        return _new_workbook()
    wb = load_workbook(path)
    if SHEET not in wb.sheetnames:
        raise ValueError(f"Faile {path.name} nėra lapo „{SHEET}“.")
    return wb


def existing_invoice_numbers(path: Path) -> set[str]:
    if not path.exists():
        return set()
    ws = _open(path)[SHEET]
    return {str(r[0]).strip() for r in ws.iter_rows(min_row=2, max_col=1, values_only=True) if r[0]}


def append_invoices(path: Path, invoices: list[Invoice]) -> None:
    """Prideda eilutes ir išsaugo. Rašoma į laikiną failą, kad nesugadintų esamo."""
    if not invoices:
        return
    wb = _open(path)
    ws = wb[SHEET]
    now = datetime.now().replace(microsecond=0)
    for inv in invoices:
        notes = list(inv.warnings)
        if inv.missing:
            notes.append("Nerasta: " + ", ".join(inv.missing))
        ws.append([
            inv.invoice_number,
            inv.invoice_date,
            inv.vin,
            inv.kerb_weight,
            inv.co2,
            inv.color,
            inv.decor,
            inv.factory_code,
            inv.total,
            inv.source_file,
            now,
            "; ".join(notes) or None,
        ])
        row = ws.max_row
        for col, header in enumerate(HEADERS, start=1):
            if header in NUMBER_FORMATS:
                ws.cell(row, col).number_format = NUMBER_FORMATS[header]
        if notes:
            ws.cell(row, len(HEADERS)).font = Font(color="C00000")
    ws.auto_filter.ref = f"A1:{ws.cell(1, len(HEADERS)).column_letter}{ws.max_row}"

    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"~tmp_{path.name}")
    try:
        wb.save(tmp)
        tmp.replace(path)
    except PermissionError as exc:
        tmp.unlink(missing_ok=True)
        raise ExcelLockedError(
            f"Nepavyko įrašyti į {path.name} – uždarykite jį Excel'yje ir bandykite dar kartą."
        ) from exc
