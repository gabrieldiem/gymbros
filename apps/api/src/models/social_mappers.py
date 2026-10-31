"""Crew tab domain objects → API models."""

from db.tables.user import User
from models.social import (
    ActorModel,
    CommentModel,
    FeedItemModel,
    FeedResponse,
    HallOfFameResponse,
    ImprovedModel,
    InactiveModel,
    InboxResponse,
    NotificationModel,
    ReactionsModel,
    RecordModel,
)
from services.social_types import (
    CommentView,
    FeedEntry,
    FeedPage,
    HallOfFame,
    Inbox,
    ReactionSummary,
)


def to_actor(user: User) -> ActorModel:
    """A member as shown on cards."""
    return ActorModel.model_validate(
        {
            "user_id": user.id,
            "display_name": user.display_name,
            "initials": user.initials,
            "color": user.color,
        }
    )


def to_reactions(summary: ReactionSummary) -> ReactionsModel:
    """Reaction counts plus your own."""
    return ReactionsModel.model_validate(
        {
            "fist": summary.counts.get("fist", 0),
            "fire": summary.counts.get("fire", 0),
            "mine": sorted(summary.mine),
        }
    )


def to_comment(view: CommentView) -> CommentModel:
    """A comment with its author."""
    c = view.comment
    return CommentModel(
        id=c.id,
        author=to_actor(view.author),
        body=c.body,
        quick_key=c.quick_key,
        created_at=c.created_at,
    )


def _item(entry: FeedEntry, reader: User) -> FeedItemModel:
    item = entry.item
    return FeedItemModel(
        id=item.id,
        kind=item.kind,
        actor=to_actor(entry.actor),
        created_at=item.created_at,
        vars=item.vars,
        reactions=to_reactions(entry.reactions),
        comments=[to_comment(c) for c in entry.comments],
        is_mine=item.actor_id == reader.id,
    )


def to_feed_response(page: FeedPage, reader: User) -> FeedResponse:
    """A feed page."""
    return FeedResponse(
        items=[_item(e, reader) for e in page.entries],
        inactive=[InactiveModel(member=to_actor(i.user), days=i.days) for i in page.inactive],
        next_before=page.next_before,
    )


def to_inbox_response(inbox: Inbox) -> InboxResponse:
    """The inbox."""
    return InboxResponse(
        items=[
            NotificationModel(
                id=e.notification.id,
                key=e.notification.key,
                vars=e.notification.vars,
                link=e.notification.link,
                created_at=e.notification.created_at,
                read=e.notification.read_at is not None,
                actor=to_actor(e.actor) if e.actor else None,
            )
            for e in inbox.entries
        ],
        unread=inbox.unread,
    )


def to_hall_of_fame_response(hof: HallOfFame) -> HallOfFameResponse:
    """The Hall of fame."""
    return HallOfFameResponse(
        most_improved=[
            ImprovedModel(member=to_actor(m.user), pct=m.pct) for m in hof.most_improved
        ],
        records=[
            RecordModel(key=r.key, holder=to_actor(r.holder), vars=r.vars) for r in hof.records
        ],
    )
