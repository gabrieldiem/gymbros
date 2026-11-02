"""What's new response models."""

from datetime import date

from pydantic import BaseModel


class WhatsNewModel(BaseModel):
    """A feature. The web app holds its copy, under its id."""

    id: str
    date: date
    link: str
