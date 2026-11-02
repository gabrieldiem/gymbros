"""Where a gym is: finding it, saving it, and friends being able to open it on a map."""

import pytest

from dependencies import get_map_link_resolver, get_place_search
from main import app
from services.errors import PlacesUnavailable
from services.places import Place
from tests.application.conftest import register_on

SPOT = {"lat": -34.5892, "lon": -58.41, "address": "Av. Santa Fe 3200, Buenos Aires"}
BENCH = {"exercise_id": "bench", "sets": [{"load_kg": 60, "reps": 5, "done": True}]}


class FakeSearch:
    def __init__(self):
        self.asked = []
        self.down = False

    async def search(self, query, language):
        self.asked.append((query, language))
        if self.down:
            raise PlacesUnavailable(query)
        return [Place("Tolón", "Santa Fe 3200, Buenos Aires", -34.5892, -58.41)]


class FakeResolver:
    def __init__(self, target=None):
        self.target = target

    async def resolve(self, _url):
        return self.target


@pytest.fixture
def places(client):
    fake = FakeSearch()
    app.dependency_overrides[get_place_search] = lambda: fake
    return fake


@pytest.fixture
def resolver(client):
    fake = FakeResolver()
    app.dependency_overrides[get_map_link_resolver] = lambda: fake
    return fake


async def add(client, name="Smart Fit", location=SPOT):
    return await client.post("/api/me/gyms", json={"name": name, "location": location})


# --- Finding a place ------------------------------------------------------------------------


async def test_a_search_needs_a_session(client, places):
    assert (await client.get("/api/places?q=Santa+Fe")).status_code == 401


async def test_a_search_finds_places_in_your_language(client, member, places):
    await client.patch("/api/me", json={"language": "es"})
    response = await client.get("/api/places?q=Santa+Fe+3200")
    assert response.status_code == 200
    assert response.json() == [
        {"name": "Tolón", "address": "Santa Fe 3200, Buenos Aires", "lat": -34.5892, "lon": -58.41}
    ]
    assert places.asked == [("Santa Fe 3200", "es")]


async def test_a_search_has_to_say_something(client, member, places):
    assert (await client.get("/api/places?q=")).status_code == 422
    assert (await client.get("/api/places?q=" + "x" * 201)).status_code == 422


async def test_when_search_is_down_it_says_so(client, member, places):
    places.down = True
    response = await client.get("/api/places?q=Santa+Fe")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "places_unavailable"


async def from_link(client, url):
    return await client.post("/api/places/from-link", json={"url": url})


async def test_a_pasted_link_gives_the_place(client, member, places, resolver):
    url = "https://www.google.com/maps/place/Smart+Fit/@-34.5,-58.4,17z"
    response = await from_link(client, url)
    assert response.status_code == 200
    assert response.json() == {"name": "Smart Fit", "address": None, "lat": -34.5, "lon": -58.4}
    assert places.asked == []


async def test_a_short_link_is_followed_first(client, member, places, resolver):
    resolver.target = "https://www.google.com/maps/place/Gym/@-34.5,-58.4,17z"
    response = await from_link(client, "https://maps.app.goo.gl/abc")
    assert response.json()["lat"] == -34.5


async def test_a_link_with_only_words_is_searched_for(client, member, places, resolver):
    response = await from_link(client, "https://www.google.com/maps?q=Santa+Fe+3200")
    assert response.json()["name"] == "Tolón"
    assert places.asked[0][0] == "Santa Fe 3200"


async def test_a_link_that_says_nothing_is_refused(client, member, places, resolver):
    response = await from_link(client, "https://example.com/gym")
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "map_link_not_understood"


# --- Saving it ------------------------------------------------------------------------------


async def test_a_gym_keeps_where_it_is(client, member):
    gym = (await add(client)).json()
    assert gym["location"] == SPOT
    assert (await client.get("/api/me/gyms")).json()[0]["location"] == SPOT


async def test_the_map_is_optional(client, member):
    gym = (await client.post("/api/me/gyms", json={"name": "Home"})).json()
    assert gym["location"] is None


async def test_a_place_has_to_be_on_earth(client, member):
    assert (await add(client, location={"lat": 91, "lon": 0})).status_code == 422
    assert (await add(client, location={"lat": 0, "lon": 181})).status_code == 422


async def test_a_location_can_be_added_changed_and_removed(client, member):
    gym = (await client.post("/api/me/gyms", json={"name": "Home"})).json()
    url = f"/api/me/gyms/{gym['id']}"
    moved = await client.patch(url, json={"location": SPOT})
    assert moved.json()["location"] == SPOT
    # Saying nothing about it leaves it alone.
    renamed = await client.patch(url, json={"name": "House"})
    assert renamed.json()["location"] == SPOT
    assert (await client.patch(url, json={"location": None})).json()["location"] is None


# --- Friends seeing it ----------------------------------------------------------------------


async def test_friends_get_where_it_is_while_you_train_and_on_the_post(
    client, other_client, crew, member
):
    await register_on(other_client, "maxo@example.com", crew.invite_code)
    await add(client)
    workout = (await client.post("/api/workouts", json={"routine_id": "push"})).json()
    live = (await other_client.get("/api/crew/training-now")).json()[0]
    assert (live["gym"], live["gym_lat"], live["gym_lon"]) == ("Smart Fit", -34.5892, -58.41)
    await client.put(f"/api/workouts/{workout['id']}", json={"exercises": [BENCH]})
    await client.post(f"/api/workouts/{workout['id']}/finish")
    feed = (await other_client.get("/api/feed")).json()["items"]
    post = next(i for i in feed if i["kind"] == "workout")
    assert (post["vars"]["gym_lat"], post["vars"]["gym_lon"]) == (-34.5892, -58.41)


async def test_a_finished_workout_keeps_where_it_was(client, member):
    gym = (await add(client)).json()
    workout = (await client.post("/api/workouts", json={"routine_id": "push"})).json()
    await client.put(f"/api/workouts/{workout['id']}", json={"exercises": [BENCH]})
    await client.post(f"/api/workouts/{workout['id']}/finish")
    await client.delete(f"/api/me/gyms/{gym['id']}")
    detail = (await client.get(f"/api/me/workouts/{workout['id']}")).json()
    assert (detail["gym"], detail["gym_lat"]) == ("Smart Fit", -34.5892)


async def test_changing_gym_while_logging_changes_where_it_was(client, member):
    await add(client)
    workout = (await client.post("/api/workouts", json={"routine_id": "push"})).json()
    url = f"/api/workouts/{workout['id']}"
    other = {"exercises": [], "gym": "Somewhere else"}
    assert (await client.put(url, json=other)).json()["gym_lat"] is None
    back = {"exercises": [], "gym": "Smart Fit"}
    assert (await client.put(url, json=back)).json()["gym_lat"] == -34.5892


async def test_a_workout_sent_later_finds_it_too(client, member):
    import uuid
    from datetime import timedelta

    from clock import utc_now

    await add(client)
    finished = utc_now() - timedelta(hours=1)
    body = {
        "routine_id": "push",
        "name": "Push day",
        "gym": "Smart Fit",
        "started_at": finished.isoformat(),
        "finished_at": finished.isoformat(),
        "exercises": [BENCH],
    }
    workout_id = uuid.uuid4()
    assert (await client.post(f"/api/workouts/{workout_id}/sync", json=body)).status_code == 200
    detail = (await client.get(f"/api/me/workouts/{workout_id}")).json()
    assert detail["gym_lon"] == -58.41


async def test_a_gym_with_no_map_has_no_coordinates(client, member):
    await client.post("/api/me/gyms", json={"name": "Home"})
    workout = (await client.post("/api/workouts", json={"routine_id": "push"})).json()
    assert workout["gym"] == "Home"
    assert workout["gym_lat"] is None


async def test_the_export_has_where_your_gyms_are(client, member):
    await add(client)
    body = (await client.get("/api/me/export")).json()
    assert body["gyms"][0]["location"] == SPOT
