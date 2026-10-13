"""Programos langas (Tkinter) – Nissan stiliaus dizainas."""

from __future__ import annotations

import os
import queue
import subprocess
import sys
import threading
import tkinter as tk
import tkinter.font as tkfont
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from PIL import Image, ImageDraw, ImageTk

from .excel import ExcelLockedError
from .processing import Result, format_eur, process_files
from .settings import load_excel_path, save_excel_path

APP_NAME = "Sąskaitos → Excel"
VERSION = "1.1"
ASSETS = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent)) / "saskaitos" / "assets"

# Nissan paletė: juoda / balta / pilka + Nissan raudona akcentams.
BLACK = "#000000"
INK = "#1A1A1A"
MUTED = "#6B6B6B"
SUBTLE = "#A6A6A6"
LINE = "#DCDCDC"
BG = "#F2F2F2"
WHITE = "#FFFFFF"
RED = "#C3002F"
RED_DARK = "#9E0026"
RED_TINT = "#FBEFF2"

STATUS = {
    #            tekstas lentelėje    akcentas    eilutės fonas
    "ok":        ("Įrašyta",     "#1E7B34",  WHITE),
    "warning":   ("Su pastaba",  "#B26A00",  "#FFF7E8"),
    "duplicate": ("Jau yra",     MUTED,      "#F6F6F6"),
    "error":     ("Klaida",      RED,        RED_TINT),
}


def open_file(path: Path) -> None:
    if sys.platform.startswith("win"):
        os.startfile(path)  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])


# ---------------------------------------------------------------- valdikliai

class FlatButton(tk.Label):
    """Plokščias mygtukas, vienodai atrodantis visose OS."""

    STYLES = {
        #             fonas   tekstas  hover fonas  hover tekstas  rėmelis
        "primary":   (RED,    WHITE,   RED_DARK,    WHITE,         RED),
        "secondary": (WHITE,  INK,     INK,         WHITE,         INK),
        "ghost":     (BG,     MUTED,   "#E6E6E6",   INK,           BG),
    }

    def __init__(self, master, text: str, command, kind: str = "primary", font=None, px=lambda n: n):
        self._colors = self.STYLES[kind]
        bg, fg, *_ , border = self._colors
        super().__init__(master, text=text, bg=bg, fg=fg, font=font, cursor="hand2",
                         padx=px(18), pady=px(8), highlightthickness=1,
                         highlightbackground=border, highlightcolor=border)
        self._command = command
        self._enabled = True
        self.bind("<Enter>", lambda e: self._paint(hover=True))
        self.bind("<Leave>", lambda e: self._paint(hover=False))
        self.bind("<ButtonRelease-1>", self._click)

    def _paint(self, hover: bool) -> None:
        bg, fg, hbg, hfg, _ = self._colors
        if not self._enabled:
            self.config(bg=bg, fg=SUBTLE)
        elif hover:
            self.config(bg=hbg, fg=hfg)
        else:
            self.config(bg=bg, fg=fg)

    def _click(self, event) -> None:
        if self._enabled and 0 <= event.x < self.winfo_width() and 0 <= event.y < self.winfo_height():
            self._command()

    def set_enabled(self, enabled: bool) -> None:
        self._enabled = enabled
        self.config(cursor="hand2" if enabled else "arrow")
        self._paint(hover=False)


class StatCard(tk.Frame):
    def __init__(self, master, label: str, accent: str, fonts, px):
        super().__init__(master, bg=WHITE, highlightthickness=1, highlightbackground=LINE)
        tk.Frame(self, bg=accent, width=px(4)).pack(side="left", fill="y")
        body = tk.Frame(self, bg=WHITE, padx=px(14), pady=px(10))
        body.pack(side="left", fill="both", expand=True)
        self.value = tk.Label(body, text="0", bg=WHITE, fg=INK, font=fonts["stat"], anchor="w")
        self.value.pack(fill="x")
        tk.Label(body, text=label.upper(), bg=WHITE, fg=MUTED, font=fonts["caption"], anchor="w").pack(fill="x")

    def set(self, n: int) -> None:
        self.value.config(text=str(n))


class DropZone(tk.Canvas):
    """Laukelis, į kurį metami failai. Rodo ir apdorojimo eigą."""

    def __init__(self, master, fonts, px, on_click):
        super().__init__(master, bg=WHITE, highlightthickness=0, height=px(150), cursor="hand2")
        self.fonts, self.px = fonts, px
        self.state = "idle"  # idle | hover | busy
        self.progress = (0, 0, "")
        self.title = "Nutempkite PDF sąskaitas čia"
        self.subtitle = "arba spauskite ir pasirinkite failus  •  galima kelis failus ar visą aplanką"
        self.bind("<Configure>", lambda e: self.redraw())
        self.bind("<Enter>", lambda e: self.set_state("hover") if self.state == "idle" else None)
        self.bind("<Leave>", lambda e: self.set_state("idle") if self.state == "hover" else None)
        self.bind("<ButtonRelease-1>", lambda e: on_click() if self.state != "busy" else None)

    def set_state(self, state: str) -> None:
        self.state = state
        self.config(cursor="watch" if state == "busy" else "hand2")
        self.redraw()

    def set_progress(self, done: int, total: int, name: str) -> None:
        self.progress = (done, total, name)
        self.redraw()

    def _round_rect(self, x1, y1, x2, y2, r, **kw):
        pts = [x1 + r, y1, x2 - r, y1, x2, y1, x2, y1 + r, x2, y2 - r, x2, y2,
               x2 - r, y2, x1 + r, y2, x1, y2, x1, y2 - r, x1, y1 + r, x1, y1]
        return self.create_polygon(pts, smooth=True, **kw)

    def redraw(self) -> None:
        px = self.px
        self.delete("all")
        w, h = self.winfo_width(), self.winfo_height()
        if w < 10:
            return
        active = self.state in ("hover", "busy")
        self._round_rect(px(2), px(2), w - px(2), h - px(2), px(10),
                         fill=RED_TINT if active else WHITE,
                         outline=RED if active else "#BDBDBD", width=max(1, px(1.5)), dash=(6, 4))
        cx, cy = w / 2, h / 2 - px(18)

        if self.state == "busy":
            done, total, name = self.progress
            self.create_text(cx, cy, text=f"Apdorojama {done} iš {total}…", fill=INK, font=self.fonts["h2"])
            bar_w, bar_y = min(px(420), w - px(80)), cy + px(30)
            self.create_rectangle(cx - bar_w / 2, bar_y, cx + bar_w / 2, bar_y + px(4), fill=LINE, width=0)
            frac = done / total if total else 0
            self.create_rectangle(cx - bar_w / 2, bar_y, cx - bar_w / 2 + bar_w * frac, bar_y + px(4),
                                  fill=RED, width=0)
            self.create_text(cx, bar_y + px(24), text=name, fill=MUTED, font=self.fonts["small"])
            return

        # Dokumento su rodykle aukštyn ikona
        dw, dh, fold = px(26), px(32), px(8)
        x0, y0 = cx - dw / 2, cy - px(26) - dh / 2
        color = RED if active else INK
        self.create_polygon(x0, y0, x0 + dw - fold, y0, x0 + dw, y0 + fold, x0 + dw, y0 + dh, x0, y0 + dh,
                            fill="", outline=color, width=max(1, px(2)), joinstyle="round")
        self.create_line(x0 + dw - fold, y0, x0 + dw - fold, y0 + fold, x0 + dw, y0 + fold,
                         fill=color, width=max(1, px(2)))
        ax, ay = cx, y0 + dh * 0.32
        self.create_line(ax, y0 + dh - px(7), ax, ay, fill=color, width=max(1, px(2)))
        self.create_line(ax - px(6), ay + px(6), ax, ay, ax + px(6), ay + px(6), fill=color, width=max(1, px(2)))

        self.create_text(cx, cy + px(20), text=self.title, fill=INK, font=self.fonts["h2"])
        self.create_text(cx, cy + px(46), text=self.subtitle, fill=MUTED, font=self.fonts["small"])


# ---------------------------------------------------------------- langas

class App:
    def __init__(self, root: tk.Tk, dnd: bool):
        self.root = root
        self.dnd = dnd
        self.excel_path = load_excel_path()
        self.busy = False
        self.events: queue.Queue = queue.Queue()
        self.counts = {"ok": 0, "warning": 0, "duplicate": 0, "error": 0}
        self.details: dict[str, Result] = {}

        scale = root.winfo_fpixels("1i") / 96
        self.px = lambda n: max(1, int(round(n * scale)))
        self._fonts()
        self._style()
        self._build()

    # -- stilius
    def _fonts(self) -> None:
        families = set(tkfont.families(self.root))
        family = next((f for f in ("Segoe UI", "Helvetica Neue", "Inter", "Roboto", "DejaVu Sans", "Helvetica", "helvetica")
                       if f in families), "TkDefaultFont")
        self.fonts = {
            "title": (family, 15, "bold"),
            "h2": (family, 12, "bold"),
            "section": (family, 11, "bold"),
            "body": (family, 10),
            "bold": (family, 10, "bold"),
            "small": (family, 9),
            "caption": (family, 8, "bold"),
            "stat": (family, 20, "bold"),
            "mono": ("Consolas" if "Consolas" in families else "DejaVu Sans Mono", 10),
        }

    def _style(self) -> None:
        px = self.px
        style = ttk.Style(self.root)
        style.theme_use("clam")
        style.configure("Treeview", background=WHITE, fieldbackground=WHITE, foreground=INK,
                        rowheight=px(34), font=self.fonts["body"], borderwidth=0, relief="flat")
        style.map("Treeview", background=[("selected", INK)], foreground=[("selected", WHITE)])
        style.configure("Treeview.Heading", background=BG, foreground=MUTED, font=self.fonts["caption"],
                        relief="flat", borderwidth=0, padding=(px(10), px(8)))
        style.map("Treeview.Heading", background=[("active", "#E8E8E8")])
        style.layout("Treeview", [("Treeview.treearea", {"sticky": "nswe"})])
        style.configure("Treeview", indent=0)
        style.configure("Vertical.TScrollbar", background="#D0D0D0", troughcolor=WHITE, borderwidth=0,
                        arrowcolor=MUTED, relief="flat", gripcount=0)
        style.map("Vertical.TScrollbar", background=[("active", "#B0B0B0")])
        # Plonas slankiklis be rodyklių
        style.layout("Vertical.TScrollbar", [("Vertical.Scrollbar.trough", {"sticky": "ns", "children": [
            ("Vertical.Scrollbar.thumb", {"expand": "1", "sticky": "nswe"})]})])
        style.configure("Vertical.TScrollbar", width=px(10), bordercolor=WHITE, lightcolor="#D0D0D0",
                        darkcolor="#D0D0D0")

    def _image(self, name: str, height: int) -> ImageTk.PhotoImage:
        img = Image.open(ASSETS / name)
        width = round(img.width * height / img.height)
        return ImageTk.PhotoImage(img.resize((width, height), Image.LANCZOS))

    def _dot(self, color: str) -> ImageTk.PhotoImage:
        size = self.px(10)
        img = Image.new("RGBA", (size * 4, size * 4), (0, 0, 0, 0))
        ImageDraw.Draw(img).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=color)
        return ImageTk.PhotoImage(img.resize((size, size), Image.LANCZOS))

    # -- išdėstymas
    def _build(self) -> None:
        root, px, f = self.root, self.px, self.fonts
        root.title(APP_NAME)
        root.configure(bg=BG)
        root.geometry(f"{px(1100)}x{px(720)}")
        root.minsize(px(860), px(600))
        try:
            if sys.platform.startswith("win"):
                root.iconbitmap(default=str(ASSETS / "app.ico"))
            else:
                self._icon = ImageTk.PhotoImage(Image.open(ASSETS / "app_icon.png"))
                root.iconphoto(True, self._icon)
        except Exception:
            pass

        # Antraštė
        header = tk.Frame(root, bg=BLACK, height=px(76))
        header.pack(fill="x")
        header.pack_propagate(False)
        self._logo = self._image("nissan_logo_white.png", px(44))
        tk.Label(header, image=self._logo, bg=BLACK).pack(side="left", padx=(px(28), px(20)))
        tk.Frame(header, bg="#3A3A3A", width=1).pack(side="left", fill="y", pady=px(20))
        titles = tk.Frame(header, bg=BLACK)
        titles.pack(side="left", padx=px(20))
        tk.Label(titles, text=APP_NAME, bg=BLACK, fg=WHITE, font=f["title"]).pack(anchor="w")
        tk.Label(titles, text="Sąskaitų faktūrų duomenų perkėlimas į Excel", bg=BLACK, fg=SUBTLE,
                 font=f["small"]).pack(anchor="w")
        badge = tk.Label(header, text="●  OFFLINE", bg="#1C1C1C", fg="#CFCFCF", font=f["caption"],
                         padx=px(12), pady=px(5))
        badge.pack(side="right", padx=px(28))
        tk.Frame(root, bg=RED, height=px(3)).pack(fill="x")

        # Poraštė
        footer = tk.Frame(root, bg=WHITE, highlightthickness=1, highlightbackground=LINE)
        footer.pack(side="bottom", fill="x")
        inner = tk.Frame(footer, bg=WHITE, padx=px(28), pady=px(10))
        inner.pack(fill="x")
        tk.Label(inner, text="EXCEL FAILAS", bg=WHITE, fg=MUTED, font=f["caption"]).pack(side="left")
        self.path_label = tk.Label(inner, text=str(self.excel_path), bg=WHITE, fg=INK, font=f["small"])
        self.path_label.pack(side="left", padx=(px(10), px(12)))
        change = tk.Label(inner, text="Keisti…", bg=WHITE, fg=RED, font=f["small"] + ("underline",),
                          cursor="hand2")
        change.pack(side="left")
        change.bind("<Button-1>", lambda e: self.change_excel())
        tk.Label(inner, text=f"v{VERSION}  •  Duomenys niekur nesiunčiami", bg=WHITE, fg=SUBTLE,
                 font=f["small"]).pack(side="right")

        # Turinys
        body = tk.Frame(root, bg=BG, padx=px(28), pady=px(22))
        body.pack(fill="both", expand=True)

        self.drop = DropZone(body, f, px, self.choose_files)
        self.drop.pack(fill="x")
        if not self.dnd:
            self.drop.title = "Spauskite čia ir pasirinkite PDF sąskaitas"
            self.drop.subtitle = "galima pasirinkti kelis failus iš karto"
        else:
            from tkinterdnd2 import COPY, DND_FILES
            self.drop.drop_target_register(DND_FILES)
            self.drop.dnd_bind("<<DropEnter>>", lambda e: (self._drag(True), COPY)[1])
            self.drop.dnd_bind("<<DropLeave>>", lambda e: (self._drag(False), COPY)[1])
            self.drop.dnd_bind("<<Drop>>", self._on_drop)

        stats = tk.Frame(body, bg=BG)
        stats.pack(fill="x", pady=(px(18), 0))
        self.cards = {}
        for i, (key, label) in enumerate((("ok", "Įrašyta"), ("warning", "Su pastabomis"),
                                          ("duplicate", "Jau buvo"), ("error", "Klaidos"))):
            card = StatCard(stats, label, STATUS[key][1], f, px)
            card.grid(row=0, column=i, sticky="nsew", padx=(0 if i == 0 else px(12), 0))
            stats.columnconfigure(i, weight=1, uniform="stats")
            self.cards[key] = card

        bar = tk.Frame(body, bg=BG)
        bar.pack(fill="x", pady=(px(22), px(10)))
        tk.Label(bar, text="Rezultatai", bg=BG, fg=INK, font=f["section"]).pack(side="left")
        tk.Label(bar, text="dukart spustelėkite eilutę – detalės", bg=BG, fg=SUBTLE,
                 font=f["small"]).pack(side="left", padx=px(10))
        self.btn_choose = FlatButton(bar, "Pasirinkti PDF", self.choose_files, "primary", f["bold"], px)
        self.btn_choose.pack(side="right")
        self.btn_excel = FlatButton(bar, "Atidaryti Excel", self.open_excel, "secondary", f["bold"], px)
        self.btn_excel.pack(side="right", padx=px(10))
        self.btn_clear = FlatButton(bar, "Išvalyti", self.clear, "ghost", f["bold"], px)
        self.btn_clear.pack(side="right")

        table_box = tk.Frame(body, bg=WHITE, highlightthickness=1, highlightbackground=LINE)
        table_box.pack(fill="both", expand=True)
        columns = (("file", "FAILAS", 220, "w"),
                   ("number", "SĄSKAITOS NR.", 110, "w"), ("date", "DATA", 95, "w"),
                   ("vin", "VIN", 170, "w"), ("total", "SUMA", 110, "e"), ("note", "PASTABA", 260, "w"))
        self.tree = ttk.Treeview(table_box, columns=[c[0] for c in columns], show="tree headings",
                                 selectmode="browse")
        # Būsena – stulpelyje #0 su spalvotu tašku
        self.tree.heading("#0", text="BŪSENA", anchor="w")
        self.tree.column("#0", width=px(130), minwidth=px(100), stretch=False, anchor="w")
        self.dots = {key: self._dot(color) for key, (_, color, _) in STATUS.items()}
        for key, title, width, anchor in columns:
            self.tree.heading(key, text=title, anchor=anchor)
            self.tree.column(key, width=px(width), minwidth=px(60), anchor=anchor, stretch=key in ("file", "note"))
        for key, (_, _, row_bg) in STATUS.items():
            self.tree.tag_configure(key, background=row_bg)
        self.tree.tag_configure("duplicate", background=STATUS["duplicate"][2], foreground=MUTED)
        scroll = ttk.Scrollbar(table_box, orient="vertical", command=self.tree.yview)

        def autohide(first, last):  # slankiklis rodomas tik kai jo reikia
            if float(first) <= 0 and float(last) >= 1:
                scroll.pack_forget()
            elif not scroll.winfo_ismapped():
                scroll.pack(side="right", fill="y", before=self.tree)
            scroll.set(first, last)

        self.tree.configure(yscrollcommand=autohide)
        self.tree.pack(side="left", fill="both", expand=True)
        self.tree.bind("<Double-1>", self.show_details)

        self.empty = tk.Label(table_box, text="Dar neapdorota nė viena sąskaita", bg=WHITE, fg=SUBTLE,
                              font=f["body"])
        self.empty.place(relx=0.5, rely=0.55, anchor="center")

    # -- veiksmai
    def _drag(self, inside: bool) -> None:
        if not self.busy:
            self.drop.set_state("hover" if inside else "idle")

    def _on_drop(self, event):
        self.handle(list(self.root.tk.splitlist(event.data)))
        from tkinterdnd2 import COPY
        return COPY

    def choose_files(self) -> None:
        if self.busy:
            return
        files = filedialog.askopenfilenames(parent=self.root, title="Pasirinkite sąskaitas",
                                            filetypes=[("PDF failai", "*.pdf"), ("Visi failai", "*.*")])
        self.handle(list(files))

    def open_excel(self) -> None:
        if self.excel_path.exists():
            open_file(self.excel_path)
        else:
            messagebox.showinfo(APP_NAME, "Excel failas dar nesukurtas – pirmiausia įkelkite sąskaitą.",
                                parent=self.root)

    def change_excel(self) -> None:
        if self.busy:
            return
        chosen = filedialog.asksaveasfilename(
            parent=self.root, title="Kur saugoti duomenis?", defaultextension=".xlsx",
            initialdir=str(self.excel_path.parent), initialfile=self.excel_path.name,
            filetypes=[("Excel failas", "*.xlsx")], confirmoverwrite=False)
        if chosen:
            self.excel_path = Path(chosen)
            self.path_label.config(text=str(self.excel_path))
            save_excel_path(self.excel_path)

    def clear(self) -> None:
        if self.busy:
            return
        self.tree.delete(*self.tree.get_children())
        self.details.clear()
        for key in self.counts:
            self.counts[key] = 0
            self.cards[key].set(0)
        self.empty.place(relx=0.5, rely=0.55, anchor="center")

    def show_details(self, _event=None) -> None:
        sel = self.tree.selection()
        if not sel or sel[0] not in self.details:
            return
        r = self.details[sel[0]]
        lines = [f"Failas: {r.file}", "", r.message]
        if r.invoice:
            inv = r.invoice
            lines += ["",
                      f"Invoice number:  {inv.invoice_number or '—'}",
                      f"Invoice date:    {inv.invoice_date.strftime('%Y-%m-%d') if inv.invoice_date else '—'}",
                      f"VIN:             {inv.vin or '—'}",
                      f"Kerb weight:     {inv.kerb_weight if inv.kerb_weight is not None else '—'}",
                      f"CO2:             {inv.co2 if inv.co2 is not None else '—'}",
                      f"Color:           {inv.color or '—'}",
                      f"Decor:           {inv.decor or '—'}",
                      f"Factory code:    {inv.factory_code or '—'}",
                      f"Total sum:       {format_eur(inv.total) if inv.total is not None else '—'}"]
        (messagebox.showerror if r.status == "error" else messagebox.showinfo)(
            STATUS[r.status][0], "\n".join(lines), parent=self.root)

    def set_busy(self, busy: bool) -> None:
        self.busy = busy
        for b in (self.btn_choose, self.btn_clear):
            b.set_enabled(not busy)
        self.drop.set_state("busy" if busy else "idle")

    def handle(self, paths: list[str]) -> None:
        if self.busy or not paths:
            return
        self.set_busy(True)
        self.drop.set_progress(0, 0, "")
        excel = self.excel_path

        def work():
            try:
                results = process_files(paths, excel, lambda i, n, name: self.events.put(("progress", (i, n, name))))
                self.events.put(("done", results))
            except Exception as exc:
                self.events.put(("fail", exc))

        threading.Thread(target=work, daemon=True).start()
        self.root.after(50, self._poll)

    def _poll(self) -> None:
        try:
            while True:
                kind, data = self.events.get_nowait()
                if kind == "progress":
                    self.drop.set_progress(*data)
                    continue
                self.set_busy(False)
                if kind == "done":
                    self.show_results(data)
                elif isinstance(data, ExcelLockedError):
                    messagebox.showwarning("Excel failas atidarytas", str(data), parent=self.root)
                else:
                    messagebox.showerror(APP_NAME, f"Nenumatyta klaida:\n{data}", parent=self.root)
                return
        except queue.Empty:
            self.root.after(50, self._poll)

    def show_results(self, results: list[Result]) -> None:
        if results:
            self.empty.place_forget()
        first = None
        for r in reversed(results):
            inv = r.invoice
            values = (
                r.file,
                inv.invoice_number if inv and inv.invoice_number else "",
                inv.invoice_date.strftime("%Y-%m-%d") if inv and inv.invoice_date else "",
                inv.vin if inv and inv.vin else "",
                format_eur(inv.total) if inv and inv.total is not None else "",
                "" if r.status == "ok" else r.message,
            )
            item = self.tree.insert("", 0, text="  " + STATUS[r.status][0], image=self.dots[r.status],
                                    values=values, tags=(r.status,))
            self.details[item] = r
            first = item
            self.counts[r.status] += 1
        for key, card in self.cards.items():
            card.set(self.counts[key])
        if first:
            self.tree.see(first)


def _enable_hidpi() -> None:
    if sys.platform.startswith("win"):
        try:
            import ctypes
            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except Exception:
            pass


def run(initial: list[str] | None = None) -> None:
    _enable_hidpi()
    try:  # drag & drop – jei tkinterdnd2 neįdiegtas, veikia per mygtuką
        from tkinterdnd2 import TkinterDnD
        root = TkinterDnD.Tk()
        dnd = True
    except Exception:
        root = tk.Tk()
        dnd = False
    app = App(root, dnd)
    if initial:
        root.after(300, lambda: app.handle(initial))
    root.mainloop()
