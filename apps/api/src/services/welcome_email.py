"""The email a new member gets. Copy lives here because it never reaches the web app's catalogs."""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Protocol

from services.email_design import (
    band,
    block,
    button,
    footer,
    headline,
    ladder,
    page,
    paragraph,
    picture,
    scoreboard,
    steps,
    stop_link,
    title,
)
from settings import Settings


@dataclass(frozen=True, slots=True)
class EmailMessage:
    """One outgoing email."""

    to: str
    subject: str
    html: str
    text: str
    headers: tuple[tuple[str, str], ...] = ()


class EmailSender(Protocol):
    """Sends email. A failure is logged, never raised: email must not break signing in."""

    async def send(self, message: EmailMessage) -> bool:
        """Send the message, best effort. Returns whether it went out."""

    async def send_many(self, messages: Sequence[EmailMessage]) -> int:
        """Send several, best effort. Returns how many went out."""


@dataclass(frozen=True, slots=True)
class GameNumbers:
    """What the welcome email promises, always from settings.json. Never written into the copy."""

    showed_up: int
    completed_set: int
    pr: int
    weekly_goal: int
    weekly_target: int
    rank_step: int

    @classmethod
    def from_settings(cls, settings: Settings) -> "GameNumbers":
        """The numbers as they're set now."""
        return cls(
            showed_up=settings.scoring_showed_up,
            completed_set=settings.scoring_completed_set,
            pr=settings.scoring_pr,
            weekly_goal=settings.scoring_weekly_goal,
            weekly_target=settings.game_weekly_target,
            rank_step=settings.game_rank_step,
        )


@dataclass(frozen=True, slots=True)
class StopLinks:
    """For a copy sent to people who can turn email off, unlike the one at sign-up."""

    url: str
    headers: tuple[tuple[str, str], ...]


_COPY: dict[str, dict[str, Any]] = {
    "en": {
        "subject": "Welcome to GYMBROS",
        "preheader": "Your crew, one mountain, and every set counts. Here's how the climb works.",
        "hero_alt": "GYMBROS. The climb starts now.",
        "hello": "Hi {name}, you're in.",
        "lead": "GYMBROS turns your training into a mountain. You and your crew climb the same "
        "trail, and the real rival is who you were yesterday.",
        "cta": "Open GYMBROS",
        "moves": "Your first climb",
        "move_1": "Join your crew",
        "move_1_text": "Ask them for the invite code, or open their invite link.",
        "move_2": "Log a workout",
        "move_2_text": "Lifts, runs, swims, whatever you train. It works with no signal too.",
        "move_3": "Move up",
        "move_3_text": "Every point takes you closer to the summit, and to whoever's ahead.",
        "pays": "What pays",
        "pays_show": "for showing up",
        "pays_set": "for every set",
        "pays_pr": "for every PR",
        "pays_goal": "for {target} workouts in a week",
        "camps": "Seven camps to the summit",
        "here": "you start here",
        "pts": "{points} pts",
        "ranks": ["Rookie", "Grinder", "Iron", "Steel", "Beast", "Titan", "Unstoppable"],
        "tagline": "Better than yesterday.",
        "why": "You're getting this because you created a GYMBROS account.",
        "stop": "Stop these emails",
    },
    "es": {
        "subject": "Te damos la bienvenida a GYMBROS",
        "preheader": "Tu equipo, una montaña, y cada set cuenta. Así funciona la subida.",
        "hero_alt": "GYMBROS. Empieza la subida.",
        "hello": "Hola {name}, ya estás dentro.",
        "lead": "GYMBROS convierte tu entrenamiento en una montaña. Tu equipo y tú suben el mismo "
        "sendero, y el verdadero rival es quien eras ayer.",
        "cta": "Abrir GYMBROS",
        "moves": "Tu primera subida",
        "move_1": "Únete a tu equipo",
        "move_1_text": "Pídeles el código de invitación, o abre su enlace de invitación.",
        "move_2": "Registra un entreno",
        "move_2_text": "Pesas, carreras, nados, lo que entrenes. También funciona sin señal.",
        "move_3": "Sube",
        "move_3_text": "Cada punto te acerca a la cima, y a quien va delante.",
        "pays": "Lo que paga",
        "pays_show": "por aparecer",
        "pays_set": "por cada set",
        "pays_pr": "por cada PR",
        "pays_goal": "por {target} entrenos en una semana",
        "camps": "Siete campamentos hasta la cima",
        "here": "empiezas aquí",
        "pts": "{points} pts",
        "ranks": ["Novato", "Guerrero", "Hierro", "Acero", "Bestia", "Titán", "Imparable"],
        "tagline": "Mejor que ayer.",
        "why": "Recibes este email porque creaste una cuenta en GYMBROS.",
        "stop": "No recibir más estos emails",
    },
}


def _thousands(language: str, value: int) -> str:
    return f"{value:,}".replace(",", "." if language == "es" else ",")


def _camps(copy: dict, language: str, numbers: GameNumbers) -> list[tuple[str, str]]:
    ranks = copy["ranks"]
    return [
        (ranks[i], copy["pts"].format(points=_thousands(language, i * numbers.rank_step)))
        for i in range(len(ranks) - 1, -1, -1)
    ]


def _moves(copy: dict) -> list[tuple[str, str]]:
    return [(copy[f"move_{i}"], copy[f"move_{i}_text"]) for i in (1, 2, 3)]


def welcome_email(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    to: str,
    name: str,
    language: str,
    app_url: str,
    numbers: GameNumbers,
    stop: StopLinks | None = None,
) -> EmailMessage:
    """The welcome message in the member's language."""
    code = language if language in _COPY else "en"
    copy = _COPY[code]
    hello = copy["hello"].format(name=name)
    pays = [
        (f"+{numbers.showed_up}", copy["pays_show"]),
        (f"+{numbers.completed_set}", copy["pays_set"]),
        (f"+{numbers.pr}", copy["pays_pr"]),
        (f"+{numbers.weekly_goal}", copy["pays_goal"].format(target=numbers.weekly_target)),
    ]
    html = page(
        code,
        copy["preheader"],
        picture(f"{app_url}/email/hero-{code}.png", copy["hero_alt"]),
        block(headline(hello), top=8),
        block(paragraph(copy["lead"]), top=14),
        block(button(copy["cta"], app_url), top=24),
        block(title(copy["moves"]) + steps(_moves(copy)), top=44),
        block(title(copy["pays"]) + scoreboard(pays), top=14),
        block(title(copy["camps"]) + ladder(_camps(copy, code, numbers), copy["here"]), top=44),
        '<tr><td height="34" style="height:34px;font-size:0;line-height:0;">&nbsp;</td></tr>',
        band(app_url, code, copy["tagline"], button(copy["cta"], app_url, on_volt=True)),
        footer(copy["why"], stop_link(copy["stop"], stop.url) if stop else ""),
    )
    lines = [
        hello,
        copy["lead"],
        f"{copy['cta']}: {app_url}",
        copy["moves"],
        *[f"{i}. {head}: {text}" for i, (head, text) in enumerate(_moves(copy), start=1)],
        copy["pays"],
        *[f"{value} {label}" for value, label in pays],
        copy["tagline"],
    ]
    if stop:
        lines.append(f"{copy['stop']}: {stop.url}")
    return EmailMessage(
        to=to,
        subject=copy["subject"],
        html=html,
        text="\n\n".join(lines),
        headers=stop.headers if stop else (),
    )
