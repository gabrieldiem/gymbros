"""The look of every GYMBROS email: tables and inline styles, the one thing all mail apps respect.

The loud parts are PNGs in apps/web/public/email, because mail apps drop SVG and web fonts. Whoever
calls these escapes what a person wrote; these only escape what they're told is plain text.
"""

from html import escape

IRON = "#0D0D0D"
RAIL = "#050505"
PLATE = "#171717"
STEEL = "#2A2A2A"
CHALK = "#F2F2EE"
SMOKE = "#A3A39E"
VOLT = "#FFE600"
RED = "#FF3B1F"
BODY_FONT = "Barlow,'Helvetica Neue',Helvetica,Arial,sans-serif"
# Barlow Condensed where it's installed, then the narrowest thing each system has.
DISPLAY_FONT = (
    "'Barlow Condensed','Arial Narrow','Roboto Condensed','sans-serif-condensed',"
    "'Helvetica Neue',Arial,sans-serif"
)
_RESPONSIVE = (
    "@media (max-width:480px){"
    ".gb-px{padding-left:22px!important;padding-right:22px!important}"
    ".gb-h1{font-size:36px!important}"
    ".gb-huge{font-size:84px!important}"
    "}"
    "a{color:inherit}"
)


def page(language: str, preheader: str, *blocks: str) -> str:
    """A whole email: `preheader` is the line mail apps show beside the subject."""
    body = "".join(blocks)
    return (
        f'<!doctype html><html lang="{escape(language, quote=True)}"><head>'
        '<meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="color-scheme" content="dark">'
        '<meta name="supported-color-schemes" content="dark">'
        f"<title>GYMBROS</title><style>{_RESPONSIVE}</style></head>"
        f'<body style="margin:0;padding:0;background:{RAIL};">'
        '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">'
        f"{escape(preheader)}</div>"
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        f'style="background:{RAIL};"><tr><td align="center" style="padding:0;">'
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" '
        f'style="width:100%;max-width:600px;background:{IRON};color:{CHALK};'
        f'font-family:{BODY_FONT};">'
        f"{body}</table></td></tr></table></body></html>"
    )


def picture(url: str, alt: str) -> str:
    """Full-width artwork. Blocked images still leave the words, on the right background."""
    return (
        f'<tr><td style="padding:0;background:{IRON};color:{CHALK};font-family:{DISPLAY_FONT};'
        'font-size:32px;font-weight:800;font-style:italic;line-height:1.1;">'
        f'<img src="{escape(url, quote=True)}" alt="{escape(alt, quote=True)}" width="600" '
        'style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>'
    )


def block(html: str, top: int = 0, bottom: int = 0) -> str:
    """A row of content with the page's side margins."""
    return f'<tr><td class="gb-px" style="padding:{top}px 36px {bottom}px 36px;">{html}</td></tr>'


def headline(text: str, size: int = 44, color: str = CHALK) -> str:
    """The big line, in plain text."""
    return (
        f'<h1 class="gb-h1" style="margin:0;font-family:{DISPLAY_FONT};font-size:{size}px;'
        f'line-height:1.05;font-weight:800;color:{color};">{escape(text)}</h1>'
    )


def title(text: str) -> str:
    """A section's heading, in plain text."""
    return (
        f'<h2 style="margin:0 0 16px;font-family:{DISPLAY_FONT};font-size:28px;line-height:1.1;'
        f'font-weight:800;color:{CHALK};">{escape(text)}</h2>'
    )


def paragraph(text: str, color: str = CHALK, size: int = 17) -> str:
    """Body text, in plain text."""
    return (
        f'<p style="margin:0;font-size:{size}px;line-height:1.55;color:{color};">{escape(text)}</p>'
    )


def button(label: str, url: str, on_volt: bool = False) -> str:
    """A link that looks like a button everywhere: the padding is on the table cell."""
    background, ink = (IRON, VOLT) if on_volt else (VOLT, IRON)
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>'
        f'<td align="center" bgcolor="{background}" style="background:{background};'
        'border-radius:12px;">'
        f'<a href="{escape(url, quote=True)}" style="display:inline-block;padding:18px 34px;'
        f"font-family:{BODY_FONT};font-size:18px;font-weight:700;color:{ink};"
        f'text-decoration:none;border-radius:12px;">{escape(label)}</a></td></tr></table>'
    )


def steps(items: list[tuple[str, str]]) -> str:
    """Numbered moves, in order. Each has a title and a sentence."""
    rows = "".join(
        '<tr><td valign="top" width="64" style="width:64px;padding:0 0 22px;'
        f"font-family:{DISPLAY_FONT};font-size:56px;line-height:.95;font-weight:800;"
        f'font-style:italic;color:{VOLT};">{number}</td>'
        '<td valign="top" style="padding:2px 0 22px;">'
        f'<div style="font-family:{DISPLAY_FONT};font-size:24px;line-height:1.15;font-weight:800;'
        f'color:{CHALK};">{escape(name)}</div>'
        f'<div style="margin-top:4px;font-size:16px;line-height:1.5;color:{SMOKE};">'
        f"{escape(text)}</div></td></tr>"
        for number, (name, text) in enumerate(items, start=1)
    )
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
        f"{rows}</table>"
    )


def scoreboard(items: list[tuple[str, str]]) -> str:
    """Big numbers two by two, each with what it's for."""
    cells = [
        f'<td width="48%" valign="top" style="width:48%;padding:18px 16px;background:{PLATE};'
        f'border:1px solid {STEEL};border-radius:14px;">'
        f'<div style="font-family:{DISPLAY_FONT};font-size:52px;line-height:1;font-weight:800;'
        f'color:{VOLT};">{escape(value)}</div>'
        f'<div style="margin-top:6px;font-size:15px;line-height:1.35;color:{CHALK};">'
        f"{escape(label)}</div></td>"
        for value, label in items
    ]
    rows = [
        "<tr>"
        + '<td width="4%" style="width:4%;font-size:0;line-height:0;">&nbsp;</td>'.join(
            cells[i : i + 2]
        )
        + "</tr>"
        for i in range(0, len(cells), 2)
    ]
    if len(cells) % 2:  # The odd one out takes the whole row, not half of it.
        rows[-1] = (
            rows[-1]
            .replace('<td width="48%"', '<td colspan="3" width="100%"')
            .replace("width:48%;", "width:100%;")
        )
    gap = (
        '<tr><td colspan="3" height="10" style="height:10px;font-size:0;line-height:0;"></td></tr>'
    )
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
        f"{gap.join(rows)}</table>"
    )


def ladder(camps: list[tuple[str, str]], you_are_here: str) -> str:
    """The camps from the summit down, each bar longer the higher it is. You start at the last."""
    count = len(camps)
    rows = []
    for index, (name, points) in enumerate(camps):
        start = index == count - 1
        width = max(4, round(100 * (count - 1 - index) / max(count - 1, 1)))
        color = VOLT if start else (RED if index == 0 else STEEL)
        label = f"{name}, {you_are_here}" if start else name
        ink = VOLT if start else CHALK
        rows.append(
            f'<tr><td style="padding:0 0 10px;">'
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
            f'<tr><td style="font-size:15px;font-weight:700;color:{ink};">{escape(label)}</td>'
            f'<td align="right" style="font-size:14px;color:{SMOKE};">{escape(points)}</td></tr>'
            "</table>"
            f'<div style="height:10px;width:{width}%;margin-top:5px;background:{color};'
            'border-radius:5px;font-size:0;line-height:0;">&nbsp;</div></td></tr>'
        )
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
        f"{''.join(rows)}</table>"
    )


def band(app_url: str, language: str, text: str, cta: str = "") -> str:
    """The loud closing stripe, once per email: artwork for the type, with the words as its alt."""
    image = escape(f"{app_url}/email/band-{language}.png", quote=True)
    extra = (
        f'<tr><td class="gb-px" bgcolor="{VOLT}" style="padding:0 36px 34px;background:{VOLT};">'
        f"{cta}</td></tr>"
        if cta
        else ""
    )
    return (
        f'<tr><td bgcolor="{VOLT}" style="padding:12px 0;background:{VOLT};color:{IRON};'
        f'font-family:{DISPLAY_FONT};font-size:36px;font-weight:800;font-style:italic;">'
        f'<img src="{image}" alt="{escape(text, quote=True)}" width="600" '
        f'style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>{extra}'
    )


def stop_link(label: str, url: str) -> str:
    """How to turn these off, in the footer."""
    return f'<a href="{escape(url, quote=True)}" style="color:{SMOKE};">{escape(label)}</a>'


def footer(text: str, stop: str = "") -> str:
    """The small print. `stop` is already HTML, from stop_link."""
    extra = f'<div style="margin-top:8px;">{stop}</div>' if stop else ""
    return (
        f'<tr><td class="gb-px" style="padding:26px 36px 34px;font-size:13px;line-height:1.5;'
        f'color:{SMOKE};">{escape(text)}{extra}</td></tr>'
    )
