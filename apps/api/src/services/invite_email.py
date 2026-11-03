"""The email that invites someone to a crew. Copy lives here, like the welcome email."""

from html import escape
from urllib.parse import quote

from services.email_design import (
    DISPLAY_FONT,
    SMOKE,
    VOLT,
    band,
    block,
    button,
    footer,
    page,
    paragraph,
    picture,
)
from services.welcome_email import EmailMessage

_COPY = {
    "en": {
        "subject": "You're invited to {crew} on GYMBROS",
        "preheader": "{admin} wants you on the mountain.",
        "hello": "{admin} invited you to",
        "body": "Open the link and sign in with Google. You'll join the crew and start climbing: "
        "every set, run, swim and PR moves you up the mountain.",
        "cta": "Join {crew}",
        "tagline": "Better than yesterday.",
        "why": "You're getting this because {admin} entered your address. Not for you? Ignore it, "
        "and nothing happens.",
    },
    "es": {
        "subject": "Te invitaron a {crew} en GYMBROS",
        "preheader": "{admin} te quiere en la montaña.",
        "hello": "{admin} te invitó a",
        "body": "Abre el enlace y entra con Google. Te unirás al equipo y empezarás a subir: "
        "cada set, carrera, nado y PR te sube la montaña.",
        "cta": "Unirme a {crew}",
        "tagline": "Mejor que ayer.",
        "why": "Recibes esto porque {admin} escribió tu dirección. ¿No es para ti? Ignóralo, y no "
        "pasa nada.",
    },
}


def invite_link(public_url: str, invite_code: str) -> str:
    """The link that joins a crew."""
    return f"{public_url}/invite/{quote(invite_code)}"


def invite_email(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    to: str, admin_name: str, crew_name: str, language: str, link: str, app_url: str
) -> EmailMessage:
    """The invitation in the given language."""
    code = language if language in _COPY else "en"
    copy = _COPY[code]
    hello = copy["hello"].format(admin=admin_name)
    cta = copy["cta"].format(crew=crew_name)
    crew_line = (
        f'<div class="gb-h1" style="margin-top:6px;font-family:{DISPLAY_FONT};font-size:64px;'
        f'line-height:1;font-weight:800;font-style:italic;color:{VOLT};">{escape(crew_name)}</div>'
    )
    html = page(
        code,
        copy["preheader"].format(admin=admin_name),
        picture(f"{app_url}/email/banner.png", "GYMBROS"),
        block(paragraph(hello, color=SMOKE, size=20) + crew_line, top=26),
        block(paragraph(copy["body"]), top=18),
        block(button(cta, link), top=26, bottom=34),
        band(app_url, code, copy["tagline"]),
        footer(copy["why"].format(admin=admin_name)),
    )
    text = f"{hello} {crew_name}.\n\n{copy['body']}\n\n{cta}: {link}\n\n{copy['tagline']}"
    subject = copy["subject"].format(crew=crew_name)
    return EmailMessage(to=to, subject=subject, html=html, text=text)
