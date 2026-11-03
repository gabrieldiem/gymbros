"""The emails the backoffice can start from. The tags fill in for each person when it's sent."""

from dataclasses import dataclass
from typing import Any

from services.email_design import (
    band,
    block,
    button,
    footer,
    headline,
    page,
    paragraph,
    picture,
    stop_link,
)
from services.invite_email import invite_email
from services.update_email import DigestNumbers, digest_email, style_fragment
from services.welcome_email import GameNumbers, StopLinks, welcome_email

NAME_TAG = "{{name}}"
APP_TAG = "{{app_url}}"
STOP_TAG = "{{unsubscribe_url}}"
WELCOME = "welcome"
DIGEST = "digest"
ANNOUNCEMENT = "announcement"
INVITE = "invite"

_COPY: dict[str, dict[str, Any]] = {
    "en": {
        "subject": "Something new on the mountain",
        "preheader": "Here's what changed on GYMBROS.",
        "title": f"{NAME_TAG}, something new on the mountain.",
        "lead": "Say what changed and why it's worth a look, in a sentence or two.",
        "points": ["The first thing that's new", "The second thing", "And the third"],
        "cta": "Open GYMBROS",
        "tagline": "Better than yesterday.",
        "why": "You're getting this because you have a GYMBROS account.",
        "stop": "Stop these emails",
        "crew": "Iron Ridge",
        "climber": "Your top climber",
        "pr": "Your strongest",
    },
    "es": {
        "subject": "Algo nuevo en la montaña",
        "preheader": "Esto es lo que cambió en GYMBROS.",
        "title": f"{NAME_TAG}, algo nuevo en la montaña.",
        "lead": "Cuenta qué cambió y por qué vale la pena verlo, en una o dos frases.",
        "points": ["Lo primero que es nuevo", "Lo segundo", "Y lo tercero"],
        "cta": "Abrir GYMBROS",
        "tagline": "Mejor que ayer.",
        "why": "Recibes esto porque tienes una cuenta en GYMBROS.",
        "stop": "No recibir más estos emails",
        "crew": "Iron Ridge",
        "climber": "Quien más subió",
        "pr": "Tu más fuerte",
    },
}


@dataclass(frozen=True, slots=True)
class EmailTemplate:
    """One email to start from. `live` ones can also go out as they are, made for each person."""

    id: str
    subject: str
    html: str
    live: bool


def _announcement(language: str, copy: dict) -> EmailTemplate:
    points = "".join(f"<li>{point}</li>" for point in copy["points"])
    html = page(
        language,
        copy["preheader"],
        picture(f"{APP_TAG}/email/banner.png", "GYMBROS"),
        block(headline(copy["title"]), top=26),
        block(paragraph(copy["lead"]), top=14),
        block(style_fragment(f"<ul>{points}</ul>"), top=16),
        block(button(copy["cta"], APP_TAG), top=10, bottom=34),
        band(APP_TAG, language, copy["tagline"]),
        footer(copy["why"], stop_link(copy["stop"], STOP_TAG)),
    )
    return EmailTemplate(ANNOUNCEMENT, copy["subject"], html, live=False)


def _digest(language: str, copy: dict, numbers: GameNumbers) -> EmailTemplate:
    # Example numbers: sent as it is, everyone gets their own. Edited, these go out as written.
    sample = DigestNumbers(
        name=NAME_TAG,
        points=640,
        workouts=numbers.weekly_target,
        target=numbers.weekly_target,
        crew_total=2100,
        climber=(copy["climber"], 700),
        pr=(copy["pr"], 142.5),
    )
    message = digest_email("", language, sample, APP_TAG, STOP_TAG, "")
    return EmailTemplate(DIGEST, message.subject, message.html, live=True)


def all_templates(language: str, numbers: GameNumbers) -> tuple[EmailTemplate, ...]:
    """Every email GYMBROS sends, in this language."""
    code = language if language in _COPY else "en"
    copy = _COPY[code]
    stop = StopLinks(STOP_TAG, ())
    welcome = welcome_email("", NAME_TAG, code, APP_TAG, numbers, stop)
    invite = invite_email("", NAME_TAG, copy["crew"], code, APP_TAG, APP_TAG)
    return (
        _announcement(code, copy),
        EmailTemplate(WELCOME, welcome.subject, welcome.html, live=True),
        _digest(code, copy, numbers),
        EmailTemplate(INVITE, invite.subject, invite.html, live=False),
    )
