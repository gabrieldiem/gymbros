"""What steps pay, for the balance."""

from datetime import date, timedelta

from services.steps_rules import days_in, points_by_week, steps_per_day, steps_points

PER_POINT = 250
CAP = 20_000
MONDAY = date(2026, 11, 2)


def _monday_of(day: date) -> date:
    return day - timedelta(days=day.weekday())


def test_a_normal_day_pays_a_little():
    assert steps_points(1, 10_000, PER_POINT, CAP) == 40


def test_a_week_of_steps_pays_about_one_solid_workout():
    week = sum(steps_points(1, 10_000, PER_POINT, CAP) for _ in range(7))
    assert 200 <= week <= 370


def test_past_the_cap_more_steps_pay_nothing():
    assert steps_points(1, 500_000, PER_POINT, CAP) == steps_points(1, CAP, PER_POINT, CAP)


def test_a_period_has_the_cap_of_its_days():
    assert steps_points(3, 30_000, PER_POINT, CAP) == 120
    assert steps_points(3, 90_000, PER_POINT, CAP) == 3 * CAP // PER_POINT


def test_splitting_a_period_into_days_or_a_total_pays_the_same():
    apart = 3 * steps_points(1, 10_000, PER_POINT, CAP)
    assert steps_points(3, 30_000, PER_POINT, CAP) == apart


def test_too_few_steps_pay_nothing_yet():
    assert steps_points(1, 249, PER_POINT, CAP) == 0


def test_days_include_both_ends():
    assert days_in(MONDAY, MONDAY) == (MONDAY,)
    assert len(days_in(MONDAY, MONDAY + timedelta(days=2))) == 3


def test_a_period_inside_a_week_pays_into_that_week():
    days = days_in(MONDAY, MONDAY + timedelta(days=2))
    assert points_by_week(days, 120, _monday_of) == {MONDAY: 120}


def test_a_period_across_two_weeks_is_split_by_days_and_stays_exact():
    sunday = MONDAY + timedelta(days=6)
    days = days_in(sunday - timedelta(days=1), sunday + timedelta(days=1))
    split = points_by_week(days, 100, _monday_of)
    assert split == {MONDAY: 66, MONDAY + timedelta(days=7): 34}
    assert sum(split.values()) == 100


def test_a_week_that_rounds_to_nothing_gets_no_line():
    sunday = MONDAY + timedelta(days=6)
    days = days_in(sunday - timedelta(days=1), sunday + timedelta(days=1))
    assert points_by_week(days, 1, _monday_of) == {MONDAY + timedelta(days=7): 1}


def test_a_total_spreads_evenly_and_adds_up():
    spread = steps_per_day(MONDAY, MONDAY + timedelta(days=2), 10_000)
    assert sum(spread.values()) == 10_000
    assert sorted(spread.values()) == [3333, 3333, 3334]
