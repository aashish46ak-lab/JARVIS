"""Patch HudCanvas: dotted rings + red core (voice expand). Run: python patch_hud_3d.py"""
from pathlib import Path
import re

p = Path(__file__).resolve().parent / "ui.py"
t = p.read_text(encoding="utf-8")
if "JARVIS core: dotted rings" in t:
    print("Already patched")
    raise SystemExit(0)

pat = re.compile(
    r"        else:\n            (?:# ── 3D energy sphere.*?|orb_r = int\(fw \* 0\.27 \* self\._scale\).*?)"
    r"p\.drawText\(QRectF\(cx - 8[09], cy [^"]+?self\._assistant_name\)",
    re.S,
)
m = pat.search(t)
if not m:
    # broader fallback: from else: orb through assistant_name draw near center
    pat2 = re.compile(
        r"        else:\n            orb_r = int\(fw \* 0\.\d+ \* self\._scale\).*?"
        r"AlignCenter, self\._assistant_name\)",
        re.S,
    )
    m = pat2.search(t)
if not m:
    raise SystemExit("orb block not found")

new_orb = r'''        else:
            # ── JARVIS core: dotted rings + red heart, pitch-reactive ────────
            amp = float(getattr(self, "_amp_disp", 0.0) or 0.0)
            breathe = 1.0 + 0.08 * math.sin(self._tick * 0.06)
            pulse = 1.0 + amp * 0.45
            base = fw * 0.22 * self._scale * breathe * pulse

            for i in range(8, 0, -1):
                r = base * (1.9 + i * 0.08)
                a = max(0, min(90, int(18 * i + amp * 50)))
                p.setPen(Qt.PenStyle.NoPen)
                p.setBrush(QBrush(qcol(C.PRI, a // 3)))
                p.drawEllipse(QRectF(cx - r, cy - r, r * 2, r * 2))

            n_rings = 5
            for ri in range(n_rings):
                ring_r = base * (0.55 + ri * 0.28)
                n_dots = 36 + ri * 8 + int(amp * 24)
                rot = self._tick * (0.4 + ri * 0.15) + ri * 20
                a = max(40, min(220, int(70 + amp * 120 - ri * 15)))
                col = qcol(C.MUTED_C if self.muted else C.PRI, a)
                p.setPen(Qt.PenStyle.NoPen)
                p.setBrush(QBrush(col))
                for di in range(n_dots):
                    ang = math.radians(rot + di * (360.0 / n_dots))
                    dx = ring_r * math.cos(ang)
                    dy = ring_r * math.sin(ang) * 0.92
                    sz = 1.6 + amp * 1.2 + (0.4 if ri == 0 else 0)
                    p.drawEllipse(QPointF(cx + dx, cy + dy), sz, sz)

            for idx, rf in enumerate((1.15, 1.45, 1.75)):
                rr = base * rf
                p.setPen(QPen(qcol(C.PRI, 50 + int(amp * 80)), 1.5))
                p.setBrush(Qt.BrushStyle.NoBrush)
                rect = QRectF(cx - rr, cy - rr, rr * 2, rr * 2)
                start = int((self._rings[idx % 3] + idx * 40) * 16)
                p.drawArc(rect, start, int(70 * 16))

            core_r = base * (0.28 + amp * 0.12)
            rg = QRadialGradient(QPointF(cx, cy), core_r * 1.4)
            if self.muted:
                rg.setColorAt(0.0, qcol("#662222", 200))
                rg.setColorAt(0.6, qcol("#331111", 120))
                rg.setColorAt(1.0, qcol("#000000", 0))
            else:
                rg.setColorAt(0.0, qcol("#ffeeee", min(255, 220 + int(amp * 35))))
                rg.setColorAt(0.15, qcol("#ff3333", 255))
                rg.setColorAt(0.4, qcol("#cc0000", 230))
                rg.setColorAt(0.7, qcol("#880000", 120))
                rg.setColorAt(1.0, qcol("#330000", 0))
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QBrush(rg))
            p.drawEllipse(QRectF(cx - core_r, cy - core_r, core_r * 2, core_r * 2))

            spark = max(2.0, core_r * 0.25)
            sg = QRadialGradient(QPointF(cx, cy), spark)
            sg.setColorAt(0.0, qcol("#ffffff", 230))
            sg.setColorAt(0.5, qcol("#ffaaaa", 100))
            sg.setColorAt(1.0, qcol("#ff0000", 0))
            p.setBrush(QBrush(sg))
            p.drawEllipse(QRectF(cx - spark, cy - spark, spark * 2, spark * 2))

            p.setPen(QPen(qcol(C.PRI, max(100, min(255, int(140 + amp * 80)))), 1))
            p.setFont(QFont("Courier New", 12, QFont.Weight.Bold))
            p.drawText(QRectF(cx - 90, cy + base * 1.55, 180, 24),
                       Qt.AlignmentFlag.AlignCenter, self._assistant_name)'''

t = t[: m.start()] + new_orb + t[m.end() :]
p.write_text(t, encoding="utf-8")
print("HUD dotted + red core applied — run: python main.py")
