"""Emails members can turn off: the weekly digest and messages from admins."""

from dataclasses import dataclass
from html import escape

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
    },
}

_PAGE = (
    '<div style="background:#0D0D0D;padding:32px;font-family:Arial,sans-serif;color:#F2F2EE">'
    '<p style="font-size:24px;font-weight:700;font-style:italic;margin:0 0 24px">GYMBROS</p>'
    "{body}"
    '<p style="font-size:13px;color:#8E8E8A;margin:28px 0 0">{note} '
    '<a href="{stop_url}" style="color:#8E8E8A">{stop}</a></p>'
    "</div>"
)


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


def _headers(one_click_url: str) -> tuple[tuple[str, str], ...]:
    """What makes mail apps offer their own unsubscribe button (RFC 8058)."""
    return (
        ("List-Unsubscribe", f"<{one_click_url}>"),
        ("List-Unsubscribe-Post", "List-Unsubscribe=One-Click"),
    )


def digest_email(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    to: str,
    language: str,
    numbers: DigestNumbers,
    app_url: str,
    stop_url: str,
    one_click_url: str,
) -> EmailMessage:
    """The weekly digest in the member's language."""
    copy = _COPY.get(language, _COPY["en"])
    lines = [copy["hello"].format(name=numbers.name)]
    lines.append(
        copy["yours"].format(
            points=numbers.points, workouts=numbers.workouts, target=numbers.target
        )
        if numbers.workouts
        else copy["yours_none"]
    )
    lines.append(copy["crew"].format(total=numbers.crew_total))
    if numbers.climber:
        lines.append(copy["climber"].format(name=numbers.climber[0], points=numbers.climber[1]))
    if numbers.pr:
        lines.append(copy["pr"].format(name=numbers.pr[0], load=f"{numbers.pr[1]:g}"))
    subject = (
        copy["subject"].format(points=numbers.points) if numbers.workouts else copy["subject_none"]
    )
    body = "".join(
        f'<p style="font-size:{20 if i == 0 else 16}px;line-height:1.5;margin:0 0 12px;'
        f'font-weight:{700 if i == 0 else 400}">{escape(line)}</p>'
        for i, line in enumerate(lines)
    ) + (
        f'<a href="{escape(app_url, quote=True)}" style="display:inline-block;background:#FFE600;'
        "color:#0D0D0D;font-weight:700;padding:14px 24px;border-radius:12px;margin-top:12px;"
        f'text-decoration:none">{escape(copy["cta"])}</a>'
    )
    html = _PAGE.format(
        body=body,
        note=escape(copy["tagline"]),
        stop_url=escape(stop_url, quote=True),
        stop=escape(copy["stop"]),
    )
    text = "\n\n".join(
        [*lines, f"{copy['cta']}: {app_url}", copy["tagline"], f"{copy['stop']}: {stop_url}"]
    )
    return EmailMessage(
        to=to, subject=subject, html=html, text=text, headers=_headers(one_click_url)
    )


def admin_email(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    to: str, language: str, subject: str, message: str, stop_url: str, one_click_url: str
) -> EmailMessage:
    """A message written in the backoffice: nothing in it is treated as HTML."""
    copy = _COPY.get(language, _COPY["en"])
    paragraphs = [p for p in message.split("\n\n") if p.strip()]
    body = "".join(
        '<p style="font-size:16px;line-height:1.5;margin:0 0 12px">'
        + escape(p).replace("\n", "<br>")
        + "</p>"
        for p in paragraphs
    )
    html = _PAGE.format(
        body=body,
        note=escape(copy["from_admin"]),
        stop_url=escape(stop_url, quote=True),
        stop=escape(copy["stop"]),
    )
    text = f"{message}\n\n{copy['from_admin']}\n{copy['stop']}: {stop_url}"
    return EmailMessage(
        to=to, subject=subject, html=html, text=text, headers=_headers(one_click_url)
    )
