"""Climb domain objects → API models."""

from dataclasses import asdict

from models.climb import (
    ClimbChangeModel,
    ClimbResponse,
    ImprovementModel,
    MyStandingModel,
    NeighbourModel,
    NextCampModel,
    StandingModel,
)
from services.climb_types import ClimbChange, ClimbView, Standing


def _standing(standing: Standing, my_position: int) -> StandingModel:
    user = standing.user
    return StandingModel.model_validate(
        {
            "user_id": user.id,
            "display_name": user.display_name,
            "initials": user.initials,
            "color": user.color,
            "points": standing.points,
            "position": standing.position,
            "camp": standing.camp,
            "workouts_this_week": standing.workouts_this_week,
            "goal_streak": standing.goal_streak,
            "training_now": standing.training_now,
            "is_me": standing.position == my_position,
        }
    )


def _neighbour(standing: Standing | None, gap: int) -> NeighbourModel | None:
    if standing is None:
        return None
    return NeighbourModel.model_validate(
        {
            "display_name": standing.user.display_name,
            "initials": standing.user.initials,
            "color": standing.user.color,
            "gap": gap,
            "training_now": standing.training_now,
        }
    )


def _my_standing(view: ClimbView) -> MyStandingModel:
    me, index = view.me, view.me.position - 1
    above = view.standings[index - 1] if index > 0 else None
    below = view.standings[index + 1] if index + 1 < len(view.standings) else None
    return MyStandingModel(
        position=me.position,
        points=me.points,
        camp=me.camp,
        workouts_this_week=me.workouts_this_week,
        goal_streak=me.goal_streak,
        above=_neighbour(above, above.points - me.points if above else 0),
        below=_neighbour(below, me.points - below.points if below else 0),
        next_camp=(
            NextCampModel(camp=view.next_camp[0], points_needed=view.next_camp[1])
            if view.next_camp
            else None
        ),
    )


def to_climb_response(view: ClimbView) -> ClimbResponse:
    """The ATUS Climb tab body."""
    return ClimbResponse(
        mode=view.mode,
        camp_step=view.camp_step,
        summit=view.summit,
        weekly_target=view.weekly_target,
        standings=[_standing(s, view.me.position) for s in view.standings],
        me=_my_standing(view),
        improvement=ImprovementModel(**asdict(view.improvement)),
    )


def to_climb_change(change: ClimbChange) -> ClimbChangeModel:
    """The climb part of the finish response."""
    return ClimbChangeModel(**{**asdict(change), "passed": list(change.passed)})
