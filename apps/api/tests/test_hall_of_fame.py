"""Most improved: the mean of the improvement metrics a member has history for."""

from services.hall_of_fame_service import improvement_score


def test_improvement_score_averages_available_metrics():
    assert improvement_score(10, 20) == 15
    assert improvement_score(None, 18) == 18
    assert improvement_score(-4, None) == -4
    assert improvement_score(None, None) is None
