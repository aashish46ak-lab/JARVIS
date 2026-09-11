"""Patch HudCanvas orb into a 3D hologram energy sphere. Run: python patch_hud_3d.py"""
from pathlib import Path
import re

p = Path(__file__).resolve().parent / "ui.py"
t = p.read_text(encoding="utf-8")
if "3D energy sphere" in t:
    print("Already patched")
    raise SystemExit(0)

pat = re.compile(
    r"        else:\n            orb_r = int\(fw \* 0\.27 \* self\._scale\).*?"
    r"p\.drawText\(QRectF\(cx - 80, cy - 14, 160, 28\),\n"
    r"                       Qt\.AlignmentFlag\.AlignCenter, self\._assistant_name\)",
    re.S,
)
m = pat.search(t)
if not m:
    raise SystemExit("orb block not found — ui.py structure may differ")

new_orb = r'''        else:
            # ── 3D energy sphere (hologram core) ─────────────────────────────
            orb_r = int(fw * 0.30 * self._scale)
            for i in range(14, 0, -1):
                r2  = int(orb_r * (1.55 - i * 0.04))
                frc = i / 14
                a   = max(0, min(255, int(self._halo * 0.12 * frc + self._amp_disp * 40)))
                if self.muted:
                    col = qcol(C.MUTED_C, a)
                else:
                    col = qcol(C.PRI if i > 6 else C.ACC, a)
                p.setPen(Qt.PenStyle.NoPen)
                p.setBrush(QBrush(col))
                p.drawEllipse(QRectF(cx - r2, cy - r2, r2 * 2, r2 * 2))
            core_r = max(8, int(orb_r * 0.72))
            grad = QRadialGradient(QPointF(cx - core_r * 0.25, cy - core_r * 0.3), core_r * 1.2)
            if self.muted:
                grad.setColorAt(0.0, qcol("#884444", 230))
                grad.setColorAt(0.45, qcol("#441111", 180))
                grad.setColorAt(1.0, qcol("#110000", 40))
            else:
                boost = 0.15 + 0.35 * self._amp_disp
                grad.setColorAt(0.0, qcol(C.ACC2, min(255, int(240 + boost * 15))))
                grad.setColorAt(0.25, qcol(C.ACC, min(255, int(200 + boost * 40))))
                grad.setColorAt(0.55, qcol(C.PRI, min(255, int(160 + boost * 50))))
                grad.setColorAt(0.85, qcol(C.PRI_DIM, 90))
                grad.setColorAt(1.0, qcol(C.BG, 20))
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QBrush(grad))
            p.drawEllipse(QRectF(cx - core_r, cy - core_r, core_r * 2, core_r * 2))
            hr = max(4, int(core_r * 0.28))
            hx, hy = cx - core_r * 0.28, cy - core_r * 0.32
            hg = QRadialGradient(QPointF(hx, hy), hr)
            hg.setColorAt(0.0, qcol("#ffffff", 200))
            hg.setColorAt(0.5, qcol("#ffffff", 60))
            hg.setColorAt(1.0, qcol("#ffffff", 0))
            p.setBrush(QBrush(hg))
            p.drawEllipse(QRectF(hx - hr, hy - hr, hr * 2, hr * 2))
            p.setBrush(Qt.BrushStyle.NoBrush)
            for lat in (-0.55, -0.25, 0.0, 0.25, 0.55):
                ry = core_r * abs(math.cos(math.asin(max(-1, min(1, lat)))))
                yy = cy + core_r * lat
                a = max(30, min(180, int(90 + self._halo * 0.4)))
                p.setPen(QPen(qcol(C.PRI, a), 1))
                p.drawEllipse(QRectF(cx - ry, yy - ry * 0.22, ry * 2, ry * 0.44))
            for ang in range(0, 180, 30):
                p.setPen(QPen(qcol(C.PRI, 70), 1))
                p.drawArc(QRectF(cx - core_r, cy - core_r, core_r * 2, core_r * 2),
                          int((ang + self._tick * 0.4) * 16), int(40 * 16))
            p.setPen(QPen(qcol(C.PRI, max(80, min(255, int(self._halo * 2)))), 1))
            p.setFont(QFont("Courier New", 13, QFont.Weight.Bold))
            p.drawText(QRectF(cx - 80, cy - 14, 160, 28),
                       Qt.AlignmentFlag.AlignCenter, self._assistant_name)'''

t = t[:m.start()] + new_orb + t[m.end():]
p.write_text(t, encoding="utf-8")
print("HUD 3D energy sphere applied — restart: python main.py")
