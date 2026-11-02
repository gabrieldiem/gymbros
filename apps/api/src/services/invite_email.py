"""The email that invites someone to a crew. Copy lives here, like the welcome email."""

from html import escape
from urllib.parse import quote

from services.welcome_email import EmailMessage

_COPY = {
    "en": {
        "subject": "You're invited to {crew} on GYMBROS",
        "hello": "{admin} invited you to {crew}.",
        "body": "Open the link and sign in with Google. You'll join the crew and start climbing: "
        "every set, run, swim and PR moves you up the mountain.",
        "cta": "Join {crew}",
        "tagline": "Better than yesterday.",
    },
    "es": {
        "subject": "Te invitaron a {crew} en GYMBROS",
        "hello": "{admin} te invitó a {crew}.",
        "body": "Abre el enlace y entra con Google. Te unirás al equipo y empezarás a subir: "
        "cada set, carrera, nado y PR te sube la montaña.",
        "cta": "Unirme a {crew}",
        "tagline": "Mejor que ayer.",
    },
}


def invite_link(public_url: str, invite_code: str) -> str:
    """The link that joins a crew."""
    return f"{public_url}/invite/{quote(invite_code)}"


def invite_email(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    to: str, admin_name: str, crew_name: str, language: str, link: str
) -> EmailMessage:
    """The invitation in the given language."""
    copy = _COPY.get(language, _COPY["en"])
    hello = copy["hello"].format(admin=admin_name, crew=crew_name)
    cta = copy["cta"].format(crew=crew_name)
    html = (
        '<div style="background:#0D0D0D;padding:32px;font-family:Arial,sans-serif;color:#F2F2EE">'
        '<p style="font-size:24px;font-weight:700;font-style:italic;margin:0 0 24px">GYMBROS</p>'
        f'<p style="font-size:20px;font-weight:700;margin:0 0 12px">{escape(hello)}</p>'
        f'<p style="font-size:16px;line-height:1.5;margin:0 0 24px">{escape(copy["body"])}</p>'
        f'<a href="{escape(link, quote=True)}" style="display:inline-block;background:#FFE600;'
        "color:#0D0D0D;font-weight:700;padding:14px 24px;border-radius:12px;"
        f'text-decoration:none">{escape(cta)}</a>'
        f'<p style="font-size:14px;color:#8E8E8A;margin:24px 0 0">{escape(copy["tagline"])}</p>'
        "</div>"
    )
    text = f"{hello}\n\n{copy['body']}\n\n{cta}: {link}\n\n{copy['tagline']}"
    subject = copy["subject"].format(crew=crew_name)
    return EmailMessage(to=to, subject=subject, html=html, text=text)
