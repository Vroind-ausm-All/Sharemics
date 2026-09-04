#!/usr/bin/env python3
"""Erzeugt die vier griechischen Zierborten als SVG-Kacheln.

Die Kacheln sind so konstruiert, dass sie sich horizontal nahtlos wiederholen
(Periode = viewBox-Breite). Alle Formen sind schwarz auf transparent, damit sie
im CSS als `mask-image` verwendet und dort eingefaerbt werden koennen.

    python3 tools/ornaments.py
"""

from __future__ import annotations

import math
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src" / "assets" / "img" / "ornaments"


def f(value: float) -> str:
    """Kurze Zahlendarstellung ohne ueberfluessige Nullen."""
    text = f"{value:.2f}".rstrip("0").rstrip(".")
    return "0" if text in ("-0", "") else text


def polyline(points, close=False) -> str:
    head = f"M{f(points[0][0])} {f(points[0][1])}"
    return head + segments(points) + ("Z" if close else "")


def segments(points) -> str:
    """Nur die L-Befehle — zum Anhaengen an einen bereits offenen Pfad."""
    return "".join(f"L{f(x)} {f(y)}" for x, y in points[1:])


def spiral(cx, cy, r_start, r_end, turns, phase_deg, clockwise=False, steps=None):
    """Logarithmische Spirale als Punktliste (Bildschirmkoordinaten, y nach unten)."""
    total = turns * 2 * math.pi
    steps = steps or max(24, int(turns * 44))
    k = math.log(r_end / r_start) / total
    phase = math.radians(phase_deg)
    sign = -1.0 if clockwise else 1.0
    pts = []
    for i in range(steps + 1):
        t = total * i / steps
        r = r_start * math.exp(k * t)
        a = phase + sign * t
        pts.append((cx + r * math.cos(a), cy - r * math.sin(a)))
    return pts


def tiled(period, draw) -> str:
    """Zeichnet ein Motiv dreimal (-P, 0, +P), damit die Kachel nahtlos schliesst.

    Alles ausserhalb der viewBox wird beschnitten; Formen, die ueber den Rand
    laufen, erscheinen dadurch auf beiden Seiten korrekt.
    """
    return "\n".join(draw(dx) for dx in (-period, 0.0, period))


def svg(width, height, body, extra="") -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(width)} {f(height)}"'
        f' width="{f(width)}" height="{f(height)}"{extra}>\n{body}\n</svg>\n'
    )


def stroked(d, w, cap="butt", join="miter"):
    return (
        f'<path d="{d}" fill="none" stroke="#000" stroke-width="{f(w)}"'
        f' stroke-linecap="{cap}" stroke-linejoin="{join}"/>'
    )


# --------------------------------------------------------------------------
# 1 — Maeander (griechischer Schluessel)
# --------------------------------------------------------------------------
def meander() -> str:
    """Exakte Rechteckspirale auf einem 2er-Raster, Strich = Zwischenraum."""
    w, h = 16.0, 18.0
    key = "M-1 15H11V5H5V11H7V7H9V13H3V3H15V15"
    body = "\n".join(
        [
            stroked("M0 1H16", 1),
            stroked(key, 1),
            stroked("M0 17H16", 1),
        ]
    )
    return svg(w, h, body)


# --------------------------------------------------------------------------
# 2 — Anthemion (Palmetten-Welle)
# --------------------------------------------------------------------------
def petal(cx, cy, angle_deg, length, width) -> str:
    """Tropfenfoermiges Blatt, das von (cx, cy) in Richtung angle waechst."""
    a = math.radians(angle_deg)
    dx, dy = math.cos(a), -math.sin(a)
    nx, ny = -dy, dx
    tip = (cx + dx * length, cy + dy * length)
    belly = 0.62
    bx, by = cx + dx * length * belly, cy + dy * length * belly
    left = (bx + nx * width, by + ny * width)
    right = (bx - nx * width, by - ny * width)
    c = 0.55
    return (
        f"M{f(cx)} {f(cy)}"
        f"C{f(cx + nx * width * 0.35 + dx * length * 0.2)} {f(cy + ny * width * 0.35 + dy * length * 0.2)},"
        f"{f(left[0])} {f(left[1] - 0)},{f(left[0])} {f(left[1])}"
        f"C{f(left[0] + dx * length * c * 0.5)} {f(left[1] + dy * length * c * 0.5)},"
        f"{f(tip[0] + nx * width * 0.18)} {f(tip[1] + ny * width * 0.18)},{f(tip[0])} {f(tip[1])}"
        f"C{f(right[0] - nx * 0 + dx * length * c * 0.5)} {f(right[1] + dy * length * c * 0.5)},"
        f"{f(right[0])} {f(right[1])},{f(right[0])} {f(right[1])}"
        f"C{f(cx - nx * width * 0.35 + dx * length * 0.2)} {f(cy - ny * width * 0.35 + dy * length * 0.2)},"
        f"{f(cx)} {f(cy)},{f(cx)} {f(cy)}Z"
    )


def anthemion() -> str:
    """Palmettenband: weit gespannte Boegen, in Voluten auslaufend, mit Faecher."""
    w, h = 46.0, 34.0
    period = 46.0
    base_y = 26.0
    stroke = 1.35

    def draw(dx: float) -> str:
        cx = 23.0 + dx
        left, right = 3.0 + dx, 43.0 + dx

        # Bogen ueber der Palmette
        arch = (
            f"M{f(left)} {f(base_y - 2)}"
            f"C{f(left + 1.6)} {f(base_y - 13)},{f(cx - 9)} {f(base_y - 21)},{f(cx)} {f(base_y - 21)}"
            f"C{f(cx + 9)} {f(base_y - 21)},{f(right - 1.6)} {f(base_y - 13)},"
            f"{f(right)} {f(base_y - 2)}"
        )

        # Voluten, in denen der Bogen ausklingt
        vol_l = polyline(spiral(left - 1.7, base_y + 0.2, 0.4, 2.35, 1.0, 60, clockwise=False))
        vol_r = polyline(spiral(right + 1.7, base_y + 0.2, 0.4, 2.35, 1.0, 120, clockwise=True))

        # Faecher aus neun Blaettern
        leaves = [
            (90, 16.0, 2.0),
            (68, 15.2, 1.95),
            (112, 15.2, 1.95),
            (48, 13.2, 1.8),
            (132, 13.2, 1.8),
            (30, 10.6, 1.55),
            (150, 10.6, 1.55),
            (13, 7.6, 1.25),
            (167, 7.6, 1.25),
        ]
        fan = "".join(petal(cx, base_y - 1.0, a, ln, wd) for a, ln, wd in leaves)

        return "\n".join(
            [
                stroked(arch, stroke, cap="round", join="round"),
                stroked(vol_l, stroke, cap="round", join="round"),
                stroked(vol_r, stroke, cap="round", join="round"),
                f'<path d="{fan}" fill="#000"/>',
                # Herzstueck am Fuss der Palmette
                f'<circle cx="{f(cx)}" cy="{f(base_y + 0.4)}" r="1.5" fill="#000"/>',
            ]
        )

    return svg(w, h, tiled(period, draw))


# --------------------------------------------------------------------------
# 3 — Laufende Welle mit Stufen (lakonisch, feine Linie)
# --------------------------------------------------------------------------
def wave_scroll() -> str:
    """Feines Wellenband: Volute, die ueber eine Stufenlinie in die naechste laeuft."""
    w, h = 17.0, 18.0
    period = 17.0
    top_rail, bottom_rail = 2.6, 15.4
    stroke = 0.75

    def draw(dx: float) -> str:
        cx, cy = 8.5 + dx, 7.6
        # Von unten links im Uhrzeigersinn nach innen einrollen.
        curl = spiral(cx, cy, 3.9, 0.55, 1.25, -128, clockwise=True)
        entry = curl[0]
        # Zulauf: Stufenlinie, die aus der vorherigen Volute heranlaeuft.
        approach = (
            f"M{f(cx - 13.4)} {f(bottom_rail - 1.1)}"
            f"H{f(cx - 10.4)}"
            f"V{f(bottom_rail - 3.0)}"
            f"H{f(cx - 7.4)}"
            f"C{f(cx - 5.4)} {f(bottom_rail - 3.0)},{f(entry[0] - 1.3)} {f(entry[1] + 1.6)},"
            f"{f(entry[0])} {f(entry[1])}"
        )
        return stroked(approach + segments(curl), stroke, cap="round", join="round")

    body = "\n".join(
        [
            stroked(f"M0 {f(top_rail)}H{f(w)}", 0.65),
            tiled(period, draw),
            stroked(f"M0 {f(bottom_rail)}H{f(w)}", 0.65),
        ]
    )
    return svg(w, h, body)


# --------------------------------------------------------------------------
# 4 — Vitruvianische Welle (kraeftiger Laufender Hund)
# --------------------------------------------------------------------------
def vitruvian() -> str:
    """Laufender Hund: kraeftige Welle, die sich in ein grosses Auge einrollt."""
    w, h = 21.0, 18.0
    period = 21.0
    top_rail, bottom_rail = 2.3, 15.7
    stroke = 1.25

    def draw(dx: float) -> str:
        cx, cy = 13.2 + dx, 9.9
        eye = spiral(cx, cy, 3.7, 0.6, 1.15, 135, clockwise=True)
        entry = eye[0]

        # Welle: steigt links auf, schwingt ueber den Scheitel und faellt ins Auge.
        crest = (
            f"M{f(cx - 15.5)} {f(cy + 3.2)}"
            f"C{f(cx - 14.6)} {f(bottom_rail - 1.2)},{f(cx - 11.6)} {f(top_rail + 1.0)},"
            f"{f(cx - 8.2)} {f(top_rail + 1.0)}"
            f"C{f(cx - 5.4)} {f(top_rail + 1.0)},{f(entry[0] - 0.4)} {f(entry[1] - 2.4)},"
            f"{f(entry[0])} {f(entry[1])}"
        )

        # Zunge, die zwischen zwei Wellen von der oberen Leiste haengt
        tongue = (
            f"M{f(cx - 6.9)} {f(bottom_rail - 1.0)}"
            f"C{f(cx - 5.0)} {f(bottom_rail - 1.2)},{f(cx - 4.4)} {f(bottom_rail - 3.6)},"
            f"{f(cx - 5.9)} {f(bottom_rail - 4.3)}"
        )

        return "\n".join(
            [
                stroked(crest + segments(eye), stroke, cap="round", join="round"),
                stroked(tongue, stroke, cap="round", join="round"),
            ]
        )

    body = "\n".join(
        [
            stroked(f"M0 {f(top_rail)}H{f(w)}", 0.95),
            tiled(period, draw),
            stroked(f"M0 {f(bottom_rail)}H{f(w)}", 0.95),
        ]
    )
    return svg(w, h, body)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    files = {
        "meander.svg": meander(),
        "anthemion.svg": anthemion(),
        "wave-scroll.svg": wave_scroll(),
        "vitruvian.svg": vitruvian(),
    }
    for name, content in files.items():
        (OUT / name).write_text(content, encoding="utf-8")
        print(f"{name:18} {len(content):6d} B")


if __name__ == "__main__":
    main()
