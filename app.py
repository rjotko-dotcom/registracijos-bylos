"""Sąskaitų -> Excel mini programėlė (visiškai offline).

Naudojimas:
  * paleisti be argumentų – atsidaro langas, į kurį galima įmesti (drag & drop)
    PDF failus arba juos pasirinkti mygtuku;
  * python app.py failas1.pdf failas2.pdf ... – apdoroja be lango (CLI);
  * nutempti PDF ant „paleisti.bat“ – tas pats kaip CLI;
  * nutempti PDF ant Saskaitos.exe – atsidaro langas ir failai iškart apdorojami.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from saskaitos.excel import ExcelLockedError
from saskaitos.processing import Result, process_files

APP_DIR = Path(sys.executable).parent if getattr(sys, "frozen", False) else Path(__file__).parent
EXCEL_PATH = Path(os.environ.get("SASKAITOS_EXCEL", APP_DIR / "saskaitos.xlsx"))

ICONS = {"ok": "✔", "warning": "⚠", "duplicate": "↺", "error": "✖"}


def run_cli(paths: list[str]) -> int:
    try:
        results = process_files(paths, EXCEL_PATH)
    except ExcelLockedError as exc:
        print(f"✖ {exc}")
        return 2
    for r in results:
        print(f"{ICONS[r.status]} {r.file}: {r.message}")
    print(f"\nExcel: {EXCEL_PATH}")
    return 1 if any(r.status == "error" for r in results) else 0


def open_file(path: Path) -> None:
    if sys.platform.startswith("win"):
        os.startfile(path)  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])


def run_gui(initial: list[str] | None = None) -> None:
    import tkinter as tk
    from tkinter import filedialog, messagebox

    try:  # drag & drop – neprivaloma priklausomybė
        from tkinterdnd2 import DND_FILES, TkinterDnD
        root = TkinterDnD.Tk()
        dnd = True
    except Exception:
        root = tk.Tk()
        dnd = False

    root.title("Sąskaitos → Excel")
    root.geometry("760x480")
    root.minsize(560, 360)

    drop = tk.Label(
        root,
        text=("Įmeskite PDF sąskaitas čia" if dnd else "Spauskite čia ir pasirinkite PDF sąskaitas")
        + "\n(galima kelias iš karto arba visą aplanką)",
        relief="groove", bd=2, bg="#eef3fb", fg="#305496",
        font=("Segoe UI", 14), height=5, cursor="hand2",
    )
    drop.pack(fill="x", padx=12, pady=(12, 6))

    buttons = tk.Frame(root)
    buttons.pack(fill="x", padx=12)
    log = tk.Text(root, height=12, wrap="word", state="disabled", font=("Consolas", 10))
    log.pack(fill="both", expand=True, padx=12, pady=6)
    for tag, color in (("ok", "#1e7b34"), ("warning", "#b26a00"), ("duplicate", "#555555"), ("error", "#c00000")):
        log.tag_configure(tag, foreground=color)
    status = tk.Label(root, text=f"Excel failas: {EXCEL_PATH}", anchor="w", fg="#555555")
    status.pack(fill="x", padx=12, pady=(0, 8))

    def write(results: list[Result]) -> None:
        log.configure(state="normal")
        for r in results:
            log.insert("end", f"{ICONS[r.status]} {r.file}: {r.message}\n", r.status)
        log.see("end")
        log.configure(state="disabled")

    def handle(paths: list[str]) -> None:
        if not paths:
            return
        root.config(cursor="watch")
        root.update_idletasks()
        try:
            results = process_files(paths, EXCEL_PATH)
        except ExcelLockedError as exc:
            messagebox.showerror("Excel užrakintas", str(exc))
            return
        except Exception as exc:
            messagebox.showerror("Klaida", f"Nenumatyta klaida: {exc}")
            return
        finally:
            root.config(cursor="")
        write(results)
        ok = sum(r.status in ("ok", "warning") for r in results)
        status.config(text=f"Įrašyta: {ok} iš {len(results)}  •  Excel failas: {EXCEL_PATH}")

    def choose(_event=None) -> None:
        handle(list(filedialog.askopenfilenames(
            title="Pasirinkite sąskaitas", filetypes=[("PDF failai", "*.pdf"), ("Visi failai", "*.*")])))

    def open_excel() -> None:
        if EXCEL_PATH.exists():
            open_file(EXCEL_PATH)
        else:
            messagebox.showinfo("Excel", "Excel failas dar nesukurtas – pirmiausia įkelkite sąskaitą.")

    tk.Button(buttons, text="Pasirinkti PDF…", command=choose).pack(side="left")
    tk.Button(buttons, text="Atidaryti Excel", command=open_excel).pack(side="left", padx=6)
    drop.bind("<Button-1>", choose)

    if dnd:
        drop.drop_target_register(DND_FILES)
        drop.dnd_bind("<<Drop>>", lambda e: handle(list(root.tk.splitlist(e.data))))

    if initial:
        root.after(200, lambda: handle(initial))
    root.mainloop()


if __name__ == "__main__":
    # .exe neturi konsolės – failai, nutempti ant jo, apdorojami lange.
    if len(sys.argv) > 1 and not getattr(sys, "frozen", False):
        code = run_cli(sys.argv[1:])
        if os.environ.get("SASKAITOS_PAUSE"):
            input("\nSpauskite Enter...")
        sys.exit(code)
    run_gui(sys.argv[1:])
