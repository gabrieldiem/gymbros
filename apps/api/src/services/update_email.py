"""Emails members can turn off: the weekly digest and messages from admins."""

import re
from dataclasses import dataclass
from html import escape
from html.parser import HTMLParser

from services.email_design import (
    CHALK,
    DISPLAY_FONT,
    RED,
    SMOKE,
    STEEL,
    VOLT,
    band,
    block,
    button,
    footer,
    headline,
    page,
    paragraph,
    picture,
    scoreboard,
    stop_link,
    title,
)
from services.welcome_email import EmailMessage

_COPY = {
    "en": {
        "subject": "Your week on GYMBROS: +{points} points",
        "subject_none": "Your crew's week on GYMBROS",
        "hello": "Hi {name}, here's your week.",
        "yours": "You: {points} points and {workouts} of {target} workouts.",
        "yours_none": "You didn't log anything last week. This week can be different.",
        "crew": "The crew climbed {total} points together.",
        "climber": "Biggest climber: {name}, with {points} points.",
        "pr": "Heaviest PR: {name}, {load} kg.",
        "cta": "Open GYMBROS",
        "tagline": "Better than yesterday.",
        "stop": "Stop these emails",
        "from_admin": "A message from the people running GYMBROS.",
        "points_word": "points last week",
        "crew_title": "Your crew",
        "crew_label": "points climbed together",
        "climber_label": "{name} climbed the most",
        "pr_label": "kg, the heaviest PR, by {name}",
        "why": "You're getting this because you have a GYMBROS account.",
    },
    "es": {
        "subject": "Tu semana en GYMBROS: +{points} puntos",
        "subject_none": "La semana de tu equipo en GYMBROS",
        "hello": "Hola {name}, esta fue tu semana.",
        "yours": "Tú: {points} puntos y {workouts} de {target} entrenos.",
        "yours_none": "No registraste nada la semana pasada. Esta puede ser distinta.",
        "crew": "El equipo subió {total} puntos.",
        "climber": "Quien más subió: {name}, con {points} puntos.",
        "pr": "PR más pesado: {name}, {load} kg.",
        "cta": "Abrir GYMBROS",
        "tagline": "Mejor que ayer.",
        "stop": "No recibir más estos emails",
        "from_admin": "Un mensaje de quienes llevan GYMBROS.",
        "points_word": "puntos la semana pasada",
        "crew_title": "Tu equipo",
        "crew_label": "puntos subidos entre todos",
        "climber_label": "{name} fue quien más subió",
        "pr_label": "kg, el PR más pesado, de {name}",
        "why": "Recibes esto porque tienes una cuenta en GYMBROS.",
    },
}


@dataclass(frozen=True, slots=True)
class DigestNumbers:
    # pylint: disable=too-many-instance-attributes
    """Last week, for one member. Names come as they are and are escaped here."""

    name: str
    points: int
    workouts: int
    target: int
    crew_total: int
    climber: tuple[str, int] | None
    pr: tuple[str, float] | None


def stop_headers(one_click_url: str) -> tuple[tuple[str, str], ...]:
    """What makes mail apps offer their own unsubscribe button (RFC 8058)."""
    return (
        ("List-Unsubscribe", f"<{one_click_url}>"),
        ("List-Unsubscribe-Post", "List-Unsubscribe=One-Click"),
    )


def _pip_color(index: int, done: int, target: int) -> str:
    if index >= target:
        return RED
    return VOLT if index < done else STEEL


def _pips(done: int, target: int) -> str:
    """One filled circle per workout, up to the target and any beyond it, in red."""
    cells = "".join(
        f'<td width="24" height="24" bgcolor="{_pip_color(i, done, target)}" '
        f'style="width:24px;height:24px;border-radius:12px;font-size:0;'
        f'background:{_pip_color(i, done, target)};">&nbsp;</td>'
        '<td width="8" style="width:8px;font-size:0;">&nbsp;</td>'
        for i in range(max(done, target))
    )
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0">'
        f"<tr>{cells}</tr></table>"
    )


def _number(language: str, value: int) -> str:
    return f"{value:,}".replace(",", "." if language == "es" else ",")


def _big_points(copy: dict, language: str, points: int) -> str:
    return (
        f'<div class="gb-huge" style="font-family:{DISPLAY_FONT};font-size:112px;line-height:.95;'
        f'font-weight:800;font-style:italic;color:{VOLT};">+{_number(language, points)}</div>'
        f'<div style="font-size:18px;color:{CHALK};">{escape(copy["points_word"])}</div>'
    )


def _crew_facts(
    copy: dict, code: str, numbers: DigestNumbers
) -> tuple[list[str], list[tuple[str, str]]]:
    """What the crew did: as sentences for the plain version, as tiles for the rich one."""
    facts = [copy["crew"].format(total=numbers.crew_total)]
    tiles = [(_number(code, numbers.crew_total), copy["crew_label"])]
    if numbers.climber:
        name, points = numbers.climber
        facts.append(copy["climber"].format(name=name, points=points))
        tiles.append((f"+{_number(code, points)}", copy["climber_label"].format(name=name)))
    if numbers.pr:
        name, weight = numbers.pr
        load = f"{weight:g}"
        facts.append(copy["pr"].format(name=name, load=load))
        shown = load.replace(".", ",") if code == "es" else load
        tiles.append((shown, copy["pr_label"].format(name=name)))
    return facts, tiles


def digest_email(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    to: str,
    language: str,
    numbers: DigestNumbers,
    app_url: str,
    stop_url: str,
    one_click_url: str,
) -> EmailMessage:
    """The weekly digest in the member's language."""
    code = language if language in _COPY else "en"
    copy = _COPY[code]
    hello = copy["hello"].format(name=numbers.name)
    yours = (
        copy["yours"].format(
            points=numbers.points, workouts=numbers.workouts, target=numbers.target
        )
        if numbers.workouts
        else copy["yours_none"]
    )
    facts, tiles = _crew_facts(copy, code, numbers)
    subject = (
        copy["subject"].format(points=numbers.points) if numbers.workouts else copy["subject_none"]
    )
    mine = (
        block(_big_points(copy, code, numbers.points), top=18)
        + block(_pips(numbers.workouts, numbers.target), top=18)
        if numbers.workouts
        else ""
    )
    html = page(
        code,
        page_preheader(copy, numbers),
        picture(f"{app_url}/email/banner.png", "GYMBROS"),
        block(headline(hello), top=26),
        mine,
        block(paragraph(yours), top=16),
        block(title(copy["crew_title"]) + scoreboard(tiles), top=34),
        block(button(copy["cta"], app_url), top=28, bottom=34),
        band(app_url, code, copy["tagline"]),
        footer(copy["why"], stop_link(copy["stop"], stop_url)),
    )
    text = "\n\n".join(
        [
            hello,
            yours,
            *facts,
            f"{copy['cta']}: {app_url}",
            copy["tagline"],
            f"{copy['stop']}: {stop_url}",
        ]
    )
    return EmailMessage(
        to=to, subject=subject, html=html, text=text, headers=stop_headers(one_click_url)
    )


def page_preheader(copy: dict, numbers: DigestNumbers) -> str:
    """The line beside the subject."""
    return copy["crew"].format(total=numbers.crew_total)


# ---- Messages written in the backoffice

_TAG_STYLES = {
    "p": f"margin:0 0 16px;font-size:17px;line-height:1.55;color:{CHALK};",
    "h1": f"margin:0 0 14px;font-family:{DISPLAY_FONT};font-size:44px;line-height:1.05;"
    f"font-weight:800;color:{CHALK};",
    "h2": f"margin:26px 0 12px;font-family:{DISPLAY_FONT};font-size:32px;line-height:1.1;"
    f"font-weight:800;color:{CHALK};",
    "h3": f"margin:22px 0 10px;font-family:{DISPLAY_FONT};font-size:24px;line-height:1.15;"
    f"font-weight:800;color:{CHALK};",
    "ul": f"margin:0 0 16px;padding-left:22px;font-size:17px;line-height:1.55;color:{CHALK};",
    "ol": f"margin:0 0 16px;padding-left:22px;font-size:17px;line-height:1.55;color:{CHALK};",
    "li": "margin:0 0 6px;",
    "blockquote": f"margin:0 0 16px;padding:4px 0 4px 16px;border-left:4px solid {VOLT};"
    f"font-size:18px;line-height:1.5;color:{CHALK};",
    "hr": f"margin:24px 0;border:0;border-top:1px solid {STEEL};",
    "a": f"color:{VOLT};",
    "img": "display:block;max-width:100%;height:auto;border:0;border-radius:12px;",
}
_STYLABLE = re.compile(rf"<({'|'.join(_TAG_STYLES)})\b(?![^>]*\bstyle=)", flags=re.IGNORECASE)
_MERGE_TAG = re.compile(r"\{\{\s*(name|app_url|unsubscribe_url)\s*\}\}")
_BODY_END = re.compile(r"</body\s*>", flags=re.IGNORECASE)


def style_fragment(html: str) -> str:
    """Mail apps read styles on the tag: what the editor writes gets them here, unless it has its
    own."""
    return _STYLABLE.sub(
        lambda found: f'<{found.group(1)} style="{_TAG_STYLES[found.group(1).lower()]}"', html
    )


def merge_tags(content: str, name: str, app_url: str, stop_url: str, *, as_html: bool) -> str:
    """Fills in {{name}}, {{app_url}} and {{unsubscribe_url}}, once: a name that looks like a tag
    stays a name."""
    values = {"name": name, "app_url": app_url, "unsubscribe_url": stop_url}
    if as_html:
        values = {key: escape(value, quote=True) for key, value in values.items()}
    return _MERGE_TAG.sub(lambda found: values[found.group(1)], content)


class _TextOnly(HTMLParser):
    """Keeps the words and where links go, for mail apps that don't show HTML."""

    _BREAKS = {"p", "div", "tr", "h1", "h2", "h3", "ul", "ol", "blockquote", "table", "hr"}
    _SKIPPED = {"style", "script", "head", "title"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skipping = 0
        self._link: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self._SKIPPED:
            self._skipping += 1
        elif tag == "br" or tag in self._BREAKS:
            self.parts.append("\n\n" if tag != "br" else "\n")
        elif tag == "li":
            self.parts.append("\n- ")
        elif tag == "a":
            self._link = dict(attrs).get("href")
        elif tag == "img":
            self.parts.append(dict(attrs).get("alt") or "")

    def handle_endtag(self, tag: str) -> None:
        if tag in self._SKIPPED:
            self._skipping = max(0, self._skipping - 1)
        elif tag in self._BREAKS:
            self.parts.append("\n\n")
        elif tag == "a" and self._link:
            self.parts.append(f" ({self._link})")
            self._link = None

    def handle_data(self, data: str) -> None:
        if not self._skipping:
            self.parts.append(re.sub(r"\s+", " ", data))


def html_to_text(html: str) -> str:
    """The plain version of an email."""
    reader = _TextOnly()
    reader.feed(html)
    text = re.sub(r"[ \t]*\n[ \t]*", "\n", "".join(reader.parts))
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def framed_message(language: str, html: str, app_url: str, stop_url: str) -> str:
    """What the editor wrote, in the GYMBROS frame."""
    code = language if language in _COPY else "en"
    copy = _COPY[code]
    return page(
        code,
        html_to_text(html)[:120],
        picture(f"{app_url}/email/banner.png", "GYMBROS"),
        block(style_fragment(html), top=26, bottom=14),
        footer(copy["from_admin"], stop_link(copy["stop"], stop_url)),
    )


def _with_stop_link(html: str, copy: dict) -> str:
    """Every message has a way to stop these. A template that forgot gets one before it ends."""
    if "unsubscribe_url" in html:
        return html
    stop = (
        '<p style="margin:24px 0;font-size:13px;text-align:center;">'
        f'<a href="{{{{unsubscribe_url}}}}" style="color:{SMOKE};">{escape(copy["stop"])}</a></p>'
    )
    ending = None
    for ending in _BODY_END.finditer(html):
        pass
    if ending is None:
        return html + stop
    return html[: ending.start()] + stop + html[ending.start() :]


@dataclass(frozen=True, slots=True)
class Recipient:
    """Who a message from the backoffice is going to, and how they stop these."""

    to: str
    name: str
    language: str
    stop_url: str
    one_click_url: str


def admin_email(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    recipient: Recipient, subject: str, html: str, app_url: str, full_document: bool = False
) -> EmailMessage:
    """A message written in the backoffice, which is HTML on purpose: only admins can send one.
    With `full_document` it's a complete email of its own; otherwise it goes in the frame."""
    code = recipient.language if recipient.language in _COPY else "en"
    copy = _COPY[code]
    document = (
        _with_stop_link(html, copy)
        if full_document
        else framed_message(code, html, app_url, "{{unsubscribe_url}}")
    )
    merged = merge_tags(document, recipient.name, app_url, recipient.stop_url, as_html=True)
    return EmailMessage(
        to=recipient.to,
        subject=merge_tags(subject, recipient.name, app_url, recipient.stop_url, as_html=False),
        html=merged,
        text=html_to_text(merged),
        headers=stop_headers(recipient.one_click_url),
    )
