"""Apply cyan circular J.A.R.V.I.S. HUD. Run: python patch_hud_3d.py"""
from pathlib import Path
import re

p = Path(__file__).resolve().parent / "ui.py"
t = p.read_text(encoding="utf-8")
if "Cyan circular J.A.R.V.I.S. HUD" in t:
    print("Already patched (cyan HUD)")
    raise SystemExit(0)

patterns = [
    re.compile(
        r"        else:\n            # ── JARVIS core: dotted rings.*?AlignCenter, st\)",
        re.S,
    ),
    re.compile(
        r"        else:\n            # ── 3D energy sphere.*?AlignCenter, self\._assistant_name\)",
        re.S,
    ),
    re.compile(
        r"        else:\n            orb_r = int\(fw \* 0\.\d+ \* self\._scale\).*?AlignCenter, self\._assistant_name\)",
        re.S,
    ),
]
m = None
for pat in patterns:
    m = pat.search(t)
    if m:
        break
if not m:
    raise SystemExit("Could not find HUD orb block in ui.py")

new = r'''        else:
            # ── Cyan circular J.A.R.V.I.S. HUD (reference style) ─────────────
            amp = float(getattr(self, "_amp_disp", 0.0) or 0.0)
            speaking = bool(getattr(self, "speaking", False))
            listen = (getattr(self, "state", "") == "LISTENING")
            tick = self._tick
            R = fw * 0.38 * self._scale * (1.0 + amp * 0.12)

            for i in range(6, 0, -1):
                rr = R * (1.15 + i * 0.06)
                a = max(0, min(70, int(8 * i + amp * 40)))
                p.setPen(Qt.PenStyle.NoPen)
                p.setBrush(QBrush(qcol("#00d4ff", a)))
                p.drawEllipse(QRectF(cx - rr, cy - rr, rr * 2, rr * 2))

            for rf, w, base_a in [
                (1.00, 3.5, 200), (0.88, 2.0, 160), (0.76, 6.0, 90),
                (0.68, 2.5, 180), (0.55, 1.5, 120), (0.42, 2.0, 100),
            ]:
                rr = R * rf
                a = max(40, min(255, int(base_a + amp * 80)))
                col = qcol("#00b8e6" if not self.muted else C.MUTED_C, a)
                p.setPen(QPen(col, w))
                p.setBrush(Qt.BrushStyle.NoBrush)
                p.drawEllipse(QRectF(cx - rr, cy - rr, rr * 2, rr * 2))

            for idx, (rf, span, gap, spd) in enumerate([
                (0.96, 50, 25, 0.7), (0.92, 30, 40, -0.5), (0.84, 70, 20, 0.35),
            ]):
                rr = R * rf
                rect = QRectF(cx - rr, cy - rr, rr * 2, rr * 2)
                ang0 = (tick * spd + idx * 40) % 360
                a = max(80, min(255, int(180 + amp * 60)))
                p.setPen(QPen(qcol("#5ce1ff", a), 3.0 if speaking else 2.0))
                p.setBrush(Qt.BrushStyle.NoBrush)
                angle = ang0
                while angle < ang0 + 360:
                    p.drawArc(rect, int(angle * 16), int(span * 16))
                    angle += span + gap

            rr = R * 0.88
            rect = QRectF(cx - rr, cy - rr, rr * 2, rr * 2)
            accent_start = int((tick * 0.6) % 360)
            p.setPen(QPen(qcol("#ffb020", min(255, 200 + int(amp * 55))), 4.0))
            p.drawArc(rect, accent_start * 16, int((40 + amp * 30) * 16))

            t_out, t_in = R * 1.02, R * 0.94
            for deg in range(0, 360, 6):
                rad = math.radians(deg + tick * 0.05)
                long = (deg % 30 == 0)
                inn = t_in if long else t_in + R * 0.03
                p.setPen(QPen(qcol("#00d4ff", 200 if long else 100), 2 if long else 1))
                p.drawLine(
                    QPointF(cx + t_out * math.cos(rad), cy - t_out * math.sin(rad)),
                    QPointF(cx + inn * math.cos(rad), cy - inn * math.sin(rad)),
                )

            for di in range(48):
                ang = math.radians(di * (360 / 48) + tick * 0.3)
                rr = R * 0.48
                sz = 1.8 + amp * 1.5
                a = max(60, min(230, int(100 + amp * 100)))
                p.setPen(Qt.PenStyle.NoPen)
                p.setBrush(QBrush(qcol("#7ef9ff", a)))
                p.drawEllipse(QPointF(cx + rr * math.cos(ang), cy - rr * math.sin(ang)), sz, sz)

            core = R * 0.36
            cg = QRadialGradient(QPointF(cx, cy), core * 1.1)
            cg.setColorAt(0.0, qcol("#0a1a28", 240))
            cg.setColorAt(0.7, qcol("#061018", 250))
            cg.setColorAt(1.0, qcol("#00a0c0", 60))
            p.setPen(QPen(qcol("#00c8e8", min(255, 120 + int(amp * 80))), 2))
            p.setBrush(QBrush(cg))
            p.drawEllipse(QRectF(cx - core, cy - core, core * 2, core * 2))

            if listen or speaking or amp > 0.05:
                pr = core * (1.15 + amp * 0.35 + 0.05 * math.sin(tick * 0.2))
                p.setPen(QPen(qcol("#00e5ff" if listen else "#5ce1ff", min(255, 80 + int(amp * 150))), 2))
                p.setBrush(Qt.BrushStyle.NoBrush)
                p.drawEllipse(QRectF(cx - pr, cy - pr, pr * 2, pr * 2))

            p.setPen(QPen(qcol("#e8f7ff", min(255, 220 + int(amp * 35))), 1))
            font = QFont("Segoe UI", max(10, int(R * 0.11)), QFont.Weight.Bold)
            font.setLetterSpacing(QFont.SpacingType.AbsoluteSpacing, 2)
            p.setFont(font)
            p.drawText(QRectF(cx - R * 0.5, cy - R * 0.08, R, R * 0.16),
                       Qt.AlignmentFlag.AlignCenter, "J.A.R.V.I.S.")

            if self.muted:
                st = "MUTED"
            elif speaking:
                st = "SPEAKING"
            elif listen:
                st = "LISTENING"
            else:
                st = str(getattr(self, "state", ""))[:12]
            p.setPen(QPen(qcol("#5ce1ff", 160), 1))
            p.setFont(QFont("Consolas", max(8, int(R * 0.045))))
            p.drawText(QRectF(cx - R * 0.4, cy + R * 0.08, R * 0.8, 18),
                       Qt.AlignmentFlag.AlignCenter, st)'''

t = t[: m.start()] + new + t[m.end() :]
p.write_text(t, encoding="utf-8")
print("Cyan J.A.R.V.I.S. HUD applied — python main.py")
