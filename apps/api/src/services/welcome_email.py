"""The email a new member gets. Copy lives here because it never reaches the web app's catalogs."""

from dataclasses import dataclass
from html import escape
from typing import Protocol


@dataclass(frozen=True, slots=True)
class EmailMessage:
    """One outgoing email."""

    to: str
    subject: str
    html: str
    text: str


class EmailSender(Protocol):
    """Sends email. A failure is logged, never raised: email must not break signing in."""

    async def send(self, message: EmailMessage) -> None:
        """Send the message, best effort."""


_COPY = {
    "en": {
        "subject": "Welcome to GYMBROS",
        "hello": "Hi {name}, you're in.",
        "body": "Ask your crew for their invite code and enter it to join them on ATUS Climb. "
        "Every set, PR and goal week moves you up the mountain.",
        "cta": "Open GYMBROS",
        "tagline": "Better than yesterday.",
    },
    "es": {
        "subject": "Te damos la bienvenida a GYMBROS",
        "hello": "Hola {name}, ya estás dentro.",
        "body": "Pide a tu equipo el código de invitación e introdúcelo para unirte a ATUS Climb. "
        "Cada set, cada PR y cada semana de meta te suben la montaña.",
        "cta": "Abrir GYMBROS",
        "tagline": "Mejor que ayer.",
    },
}


def welcome_email(to: str, name: str, language: str, app_url: str) -> EmailMessage:
    """The welcome message in the member's language."""
    copy = _COPY.get(language, _COPY["en"])
    hello = copy["hello"].format(name=name)
    html = (
        '<div style="background:#0D0D0D;padding:32px;font-family:Arial,sans-serif;color:#F2F2EE">'
        '<p style="font-size:24px;font-weight:700;font-style:italic;margin:0 0 24px">GYMBROS</p>'
        f'<p style="font-size:20px;font-weight:700;margin:0 0 12px">{escape(hello)}</p>'
        f'<p style="font-size:16px;line-height:1.5;margin:0 0 24px">{escape(copy["body"])}</p>'
        f'<a href="{escape(app_url, quote=True)}" style="display:inline-block;background:#FFE600;'
        "color:#0D0D0D;font-weight:700;padding:14px 24px;border-radius:12px;"
        f'text-decoration:none">{escape(copy["cta"])}</a>'
        f'<p style="font-size:14px;color:#8E8E8A;margin:24px 0 0">{escape(copy["tagline"])}</p>'
        "</div>"
    )
    text = f"{hello}\n\n{copy['body']}\n\n{copy['cta']}: {app_url}\n\n{copy['tagline']}"
    return EmailMessage(to=to, subject=copy["subject"], html=html, text=text)
