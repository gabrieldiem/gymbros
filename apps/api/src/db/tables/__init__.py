"""Every table module, imported here so Base.metadata is complete for Alembic."""

from db.tables.admin_action import AdminAction
from db.tables.auth_session import AuthSession
from db.tables.avatar import Avatar
from db.tables.comment import Comment
from db.tables.comment_photo import CommentPhoto
from db.tables.comment_reaction import CommentReaction
from db.tables.crew import Crew
from db.tables.digest_send import DigestSend
from db.tables.duel import Duel
from db.tables.email_settings import EmailSettings
from db.tables.feed_item import FeedItem
from db.tables.feedback import Feedback
from db.tables.gym import Gym
from db.tables.membership import Membership
from db.tables.notification import Notification
from db.tables.personal_record import PersonalRecord
from db.tables.point_event import PointEvent
from db.tables.reaction import Reaction
from db.tables.step_entry import StepEntry
from db.tables.user import User
from db.tables.user_badge import UserBadge
from db.tables.workout import Workout
from db.tables.workout_photo import WorkoutPhoto
from db.tables.workout_set import WorkoutSet

__all__ = [
    "AdminAction",
    "AuthSession",
    "Avatar",
    "Comment",
    "CommentPhoto",
    "CommentReaction",
    "Crew",
    "DigestSend",
    "Duel",
    "EmailSettings",
    "FeedItem",
    "Feedback",
    "Gym",
    "Membership",
    "Notification",
    "PersonalRecord",
    "PointEvent",
    "Reaction",
    "StepEntry",
    "User",
    "UserBadge",
    "Workout",
    "WorkoutPhoto",
    "WorkoutSet",
]
