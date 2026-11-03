"""E2E crews: the demo crew copied once per Playwright project, so e2e runs never touch the
demo crew and the two viewports never share a member."""

import copy
from typing import Any

# The train-* crews are for specs that post workouts, so what they do can't reach the specs that
# read the feed or the standings of the main crew.
E2E_PROJECTS = (
    "mobile",
    "desktop",
    "train-mobile",
    "train-desktop",
    "offline-mobile",
    "offline-desktop",
)
_MAX_INVITE_SUFFIX = 9
E2E_FREE_STEP_DAYS = 3


def e2e_crew(demo: dict[str, Any], project: str) -> dict[str, Any]:
    """The demo crew data renamed for one project: own crew, invite code and member emails."""
    data = copy.deepcopy(demo)
    data["crew"]["name"] = f"E2E {project.replace('-', ' ').title()}"
    suffix = project.replace("-", "").upper()[:_MAX_INVITE_SUFFIX]
    data["crew"]["invite_code"] = f"E2E{suffix}"
    # Specs log steps on the last few days, so those have to be open.
    data["crew"]["steps_free_days"] = E2E_FREE_STEP_DAYS
    for member in data["members"]:
        member["email"] = f"{member['key']}@{project}.e2e.gymbros.app"
        # One language to start from: a spec that switches it does so on purpose.
        member["language"] = "en"
    return data
