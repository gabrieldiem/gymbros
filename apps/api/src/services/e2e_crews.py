"""E2E crews: the demo crew copied once per Playwright project, so e2e runs never touch the
demo crew and the two viewports never share a member."""

import copy
from typing import Any

E2E_PROJECTS = ("mobile", "desktop")


def e2e_crew(demo: dict[str, Any], project: str) -> dict[str, Any]:
    """The demo crew data renamed for one project: own crew, invite code and member emails."""
    data = copy.deepcopy(demo)
    data["crew"]["name"] = f"E2E {project.title()}"
    data["crew"]["invite_code"] = f"E2E{project.upper()}"
    for member in data["members"]:
        member["email"] = f"{member['key']}@{project}.e2e.gymbros.app"
    return data
