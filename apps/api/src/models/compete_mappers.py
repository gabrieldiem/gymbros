"""Compete domain objects → API models."""

from models.climb_mappers import to_climb_response
from models.compete import (
    BadgeModel,
    BountyModel,
    CrewQuestModel,
    CrewShareModel,
    DayCount,
    DuelModel,
    HistoryModel,
    MeStatsResponse,
    PrModel,
    QuestBoardResponse,
    QuestModel,
    RecapPrModel,
    RecapResponse,
    WeekVolume,
)
from models.social_mappers import to_actor
from db.tables.workout import Workout
from services.compete_types import BadgeView, QuestBoard
from services.duel_service import DuelView
from services.me_stats_service import MeStats
from services.recap_service import Recap, RecapPr


def to_quest_board(board: QuestBoard) -> QuestBoardResponse:
    """The Quests tab."""
    crew, bounty = board.crew_quest, board.bounty
    return QuestBoardResponse(
        week_start=board.week_start,
        ends_at=board.ends_at,
        quests=[
            QuestModel(
                id=q.quest.id,
                goal=q.quest.goal,
                bonus=q.quest.bonus,
                progress=q.progress,
                claimed=q.claimed,
            )
            for q in board.quests
        ],
        crew_quest=CrewQuestModel(
            goal=crew.goal,
            bonus=crew.bonus,
            total=crew.total,
            shares=[CrewShareModel(member=to_actor(u), points=p) for u, p in crew.shares],
            claimed=crew.claimed,
        ),
        bounty=BountyModel(
            target=to_actor(bounty.target) if bounty.target else None,
            target_points=bounty.target_points,
            points=bounty.points,
            claimed_by=to_actor(bounty.claimed_by) if bounty.claimed_by else None,
        ),
        weekly_event=board.weekly_event,
        duel_points=board.duel_points,
    )


def to_badge(view: BadgeView) -> BadgeModel:
    """A badge with progress."""
    b = view.badge
    return BadgeModel(
        id=b.id,
        goal=b.goal,
        points=b.points,
        icon=b.icon,
        color=b.color,
        progress=view.progress,
        unlocked_at=view.unlocked_at,
        crew_count=view.crew_count,
    )


def to_duel(view: DuelView) -> DuelModel:
    """A duel."""
    d = view.duel
    return DuelModel.model_validate(
        {
            "id": d.id,
            "status": d.status,
            "metric": d.metric,
            "stake": d.stake_key,
            "week_start": d.week_start,
            "challenger": to_actor(view.challenger),
            "opponent": to_actor(view.opponent),
            "challenger_value": round(view.challenger_value, 1),
            "opponent_value": round(view.opponent_value, 1),
            "winner_id": d.winner_id,
        }
    )


def _pr(pr: RecapPr | None) -> RecapPrModel | None:
    if pr is None:
        return None
    return RecapPrModel(
        member=to_actor(pr.user), exercise_id=pr.exercise_id, load_kg=pr.load_kg, reps=pr.reps
    )


def to_recap(recap: Recap) -> RecapResponse:
    """Last week's slides."""
    biggest = recap.biggest_climber
    improved = recap.most_improved
    return RecapResponse(
        week_start=recap.week_start,
        crew_total=recap.crew_total,
        biggest_climber=to_actor(biggest[0]) if biggest else None,
        biggest_climber_points=biggest[1] if biggest else 0,
        biggest_climber_workouts=biggest[2] if biggest else 0,
        heaviest_pr=_pr(recap.heaviest_pr),
        my_points=recap.my_points,
        my_workouts=recap.my_workouts,
        weekly_target=recap.weekly_target,
        my_volume_kg=recap.my_volume_kg,
        position_before=recap.position_before,
        position_after=recap.position_after,
        my_best_pr=_pr(recap.my_best_pr),
        most_improved=to_actor(improved.user) if improved else None,
        most_improved_pct=improved.pct if improved else None,
        bounty_target=to_actor(recap.bounty_target) if recap.bounty_target else None,
        bounty_points=recap.bounty_points,
        weekly_event=recap.weekly_event,
    )


def _duration(workout: Workout) -> int:
    if workout.finished_at is None:
        return 0
    return max(1, round((workout.finished_at - workout.started_at).total_seconds() / 60))


def to_me_stats(stats: MeStats) -> MeStatsResponse:
    """The You tab."""
    return MeStatsResponse(
        climb=to_climb_response(stats.climb),
        workouts_total=stats.workouts_total,
        badges_unlocked=stats.badges_unlocked,
        heatmap=[DayCount(day=d, workouts=n) for d, n in stats.heatmap],
        weekly_volume=[WeekVolume(week_start=w, volume_kg=v) for w, v in stats.weekly_volume],
        prs=[
            PrModel(
                exercise_id=r.exercise_id,
                load_kg=r.load_kg,
                reps=r.reps,
                e1rm=round(r.e1rm, 1),
                achieved_at=r.achieved_at,
            )
            for r in stats.records
        ],
        history=[
            HistoryModel(
                id=h.workout.id,
                name=h.workout.name,
                finished_at=h.workout.finished_at or h.workout.started_at,
                duration_min=_duration(h.workout),
                points=h.workout.points or 0,
                sets=h.sets,
                volume_kg=round(h.workout.volume_kg or 0, 1),
            )
            for h in stats.history
        ],
    )
