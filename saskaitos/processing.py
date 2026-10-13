"""Bendra logika: failų sąrašas -> nuskaitymas -> įrašymas į Excel."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .excel import append_invoices, existing_invoice_numbers
from .parser import Invoice, InvoiceError, parse_invoice

SUPPORTED = {".pdf"}


@dataclass
class Result:
    file: str
    status: str  # "ok" | "warning" | "duplicate" | "error"
    message: str
    invoice: Invoice | None = None


def format_eur(value: float) -> str:
    return f"{value:,.2f}".replace(",", " ").replace(".", ",") + " €"


def collect_files(paths: list[str | Path]) -> list[Path]:
    """Išskleidžia aplankus ir palieka tik palaikomus failus."""
    files: list[Path] = []
    for p in map(Path, paths):
        if p.is_dir():
            files.extend(sorted(f for f in p.rglob("*") if f.suffix.lower() in SUPPORTED))
        else:
            files.append(p)
    return files


def process_files(paths: list[str | Path], excel_path: Path) -> list[Result]:
    results: list[Result] = []
    to_write: list[Invoice] = []
    known = existing_invoice_numbers(excel_path)

    for path in collect_files(paths):
        if path.suffix.lower() not in SUPPORTED:
            results.append(Result(path.name, "error", "Nepalaikomas failo tipas (kol kas tik PDF)."))
            continue
        try:
            inv = parse_invoice(path)
        except InvoiceError as exc:
            results.append(Result(path.name, "error", str(exc)))
            continue
        except Exception as exc:  # nenumatyta klaida – neturi sustabdyti kitų failų
            results.append(Result(path.name, "error", f"Nenumatyta klaida: {exc}"))
            continue

        if inv.invoice_number and inv.invoice_number in known:
            results.append(Result(path.name, "duplicate",
                                  f"Sąskaita {inv.invoice_number} jau yra Excel'yje – praleista.", inv))
            continue
        if inv.invoice_number:
            known.add(inv.invoice_number)

        to_write.append(inv)
        problems = inv.warnings + (["Nerasta: " + ", ".join(inv.missing)] if inv.missing else [])
        if problems:
            results.append(Result(path.name, "warning", "Įrašyta, bet: " + "; ".join(problems), inv))
        else:
            results.append(Result(path.name, "ok",
                                  f"Įrašyta: {inv.invoice_number}, VIN {inv.vin}, suma {format_eur(inv.total)}", inv))

    # Įrašoma vienu kartu – jei Excel užrakintas, neįrašoma niekas (be dalinių įrašų).
    append_invoices(excel_path, to_write)
    return results
