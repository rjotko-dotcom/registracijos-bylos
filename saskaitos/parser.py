"""Sąskaitų faktūrų (invoice) PDF nuskaitymas – veikia visiškai offline.

Ištraukiami laukai:
    Invoice number, Invoice date, VIN, Kerb weight, CO2, Color, Decor,
    Factory code, Total.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

import pdfplumber

# Transporto priemonės bloko etiketės. Sąskaitoje jos išdėstytos dviem
# stulpeliais, todėl vienoje eilutėje gali būti dvi etiketės – reikšmė
# baigiasi ten, kur prasideda kita etiketė arba eilutės pabaiga.
VEHICLE_LABELS = [
    r"License number\s*:",
    r"Model\s*:",
    r"Modelserie\s*:",
    r"VIN\s*:",
    r"Engine number\s*:",
    r"Total weight\s*:",
    r"Colou?r\s*:?",
    r"Kerb weight\s*:",
    r"Decor\s*:",
    r"CO2\s*:",
    r"Key code\s*:",
    r"Delivery date\s*:?",
    r"Factory code\s*:",
    r"Tariff ?number\s*:",
    r"Country of origin\s*:",
    r"Order number\s*:",
]
_ANY_LABEL = "|".join(VEHICLE_LABELS)

VIN_RE = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")
# Skaičius europietišku formatu: "26 827,60", "-1 583,30", "153,00", "1574"
NUMBER_RE = r"-?\d{1,3}(?:[ \u00a0.]\d{3})+(?:,\d+)?|-?\d+(?:,\d+)?"

FIELDS = [
    ("invoice_number", "Invoice number"),
    ("invoice_date", "Invoice date"),
    ("vin", "VIN"),
    ("kerb_weight", "Kerb weight"),
    ("co2", "CO2"),
    ("color", "Color"),
    ("decor", "Decor"),
    ("factory_code", "Factory code"),
    ("total", "Total sum"),
]


class InvoiceError(Exception):
    """Failas nėra atpažįstama sąskaita arba jo nepavyko perskaityti."""


@dataclass
class Invoice:
    invoice_number: str | None = None
    invoice_date: date | None = None
    vin: str | None = None
    kerb_weight: int | None = None
    co2: float | None = None
    color: str | None = None
    decor: str | None = None
    factory_code: str | None = None
    total: float | None = None
    source_file: str = ""
    warnings: list[str] = field(default_factory=list)

    @property
    def missing(self) -> list[str]:
        return [title for key, title in FIELDS if getattr(self, key) in (None, "")]


def to_number(raw: str) -> float:
    """'26 827,60' -> 26827.6 ; '-1 583,30' -> -1583.3 ; '1.574' -> 1574."""
    s = raw.strip().replace("\u00a0", "").replace(" ", "")
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"-?\d{1,3}(\.\d{3})+", s):
        s = s.replace(".", "")
    return float(s)


def _vehicle_field(text: str, label: str) -> str | None:
    pattern = re.compile(
        rf"(?:^|\s)(?:{label})[ \t]*(.*?)[ \t]*(?=(?:\s(?:{_ANY_LABEL}))|$)",
        re.MULTILINE | re.IGNORECASE,
    )
    m = pattern.search(text)
    if not m:
        return None
    value = m.group(1).strip()
    return value or None


def _header_field(text: str, label: str) -> str | None:
    m = re.search(rf"{label}[ \t]+(\S+)", text, re.IGNORECASE)
    return m.group(1).strip() if m else None


def _parse_date(raw: str) -> date:
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y", "%d.%m.%y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    raise ValueError(raw)


def parse_text(text: str, source_file: str = "") -> Invoice:
    inv = Invoice(source_file=source_file)

    inv.invoice_number = _header_field(text, r"Invoice (?:number|no\.?)")

    raw_date = _header_field(text, r"Invoice date")
    if raw_date:
        try:
            inv.invoice_date = _parse_date(raw_date)
        except ValueError:
            inv.warnings.append(f"Neatpažinta data: {raw_date}")

    vin = _vehicle_field(text, r"VIN\s*:")
    if vin:
        vin = vin.split()[0].upper()
        if not VIN_RE.match(vin):
            inv.warnings.append(f"VIN atrodo neteisingas: {vin}")
        inv.vin = vin

    kerb = _vehicle_field(text, r"Kerb weight\s*:")
    if kerb:
        m = re.match(NUMBER_RE, kerb)
        if m:
            inv.kerb_weight = int(round(to_number(m.group(0))))
        else:
            inv.warnings.append(f"Neatpažintas Kerb weight: {kerb}")

    co2 = _vehicle_field(text, r"CO2\s*:")
    if co2:
        m = re.match(NUMBER_RE, co2)
        if m:
            inv.co2 = to_number(m.group(0))
        else:
            inv.warnings.append(f"Neatpažintas CO2: {co2}")

    inv.color = _vehicle_field(text, r"Colou?r\s*:?")
    inv.decor = _vehicle_field(text, r"Decor\s*:")
    factory = _vehicle_field(text, r"Factory code\s*:")
    inv.factory_code = factory.split()[0] if factory else None

    # "TOTAL 26 827,60" – imame paskutinį (galutinį) TOTAL sąskaitoje.
    totals = re.findall(rf"\bTOTAL\b[^\n\d-]*({NUMBER_RE})\s*$", text, re.MULTILINE)
    if totals:
        inv.total = to_number(totals[-1])

    return inv


def extract_text(pdf_path: str | Path) -> str:
    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
    except Exception as exc:  # sugadintas / užšifruotas PDF ir pan.
        raise InvoiceError("Failas pažeistas arba tai nėra PDF – nepavyko atidaryti.") from exc
    text = "\n".join(pages)
    if not text.strip():
        raise InvoiceError(
            "PDF neturi teksto (greičiausiai skenuotas paveikslėlis) – "
            "tokie failai kol kas nepalaikomi."
        )
    return text


def parse_invoice(pdf_path: str | Path) -> Invoice:
    path = Path(pdf_path)
    inv = parse_text(extract_text(path), source_file=path.name)
    if not inv.invoice_number and not inv.vin:
        raise InvoiceError("Faile nerasta nei sąskaitos numerio, nei VIN – tai neatrodo kaip sąskaita.")
    return inv
