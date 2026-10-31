"""Every table module, imported here so Base.metadata is complete for Alembic."""

from db.tables.auth_session import AuthSession
from db.tables.comment import Comment
from db.tables.crew import Crew
from db.tables.feed_item import FeedItem
from db.tables.membership import Membership
from db.tables.notification import Notification
from db.tables.personal_record import PersonalRecord
from db.tables.point_event import PointEvent
from db.tables.reaction import Reaction
from db.tables.user import User
from db.tables.workout import Workout
from db.tables.workout_set import WorkoutSet

__all__ = [
    "AuthSession",
    "Comment",
    "Crew",
    "FeedItem",
    "Membership",
    "Notification",
    "PersonalRecord",
    "PointEvent",
    "Reaction",
    "User",
    "Workout",
    "WorkoutSet",
]
