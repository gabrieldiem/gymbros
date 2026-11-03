"""A photo of the whole workout: yours to add, your crew's to see."""

from tests.application.conftest import register_on
from tests.images import JPEG, PNG

BENCH = {"exercise_id": "bench", "sets": [{"load_kg": 60, "reps": 5, "done": True}]}


async def start(client):
    return (await client.post("/api/workouts", json={"routine_id": "push"})).json()


async def finish(client, workout_id):
    await client.put(f"/api/workouts/{workout_id}", json={"exercises": [BENCH]})
    return await client.post(f"/api/workouts/{workout_id}/finish")


async def add_photo(client, workout_id, data=JPEG):
    return await client.put(
        f"/api/workouts/{workout_id}/photo", content=data, headers={"Content-Type": "image/jpeg"}
    )


async def test_a_workout_starts_without_a_photo(client, member):
    assert (await start(client))["photo_url"] is None


async def test_a_photo_goes_up_while_logging_and_comes_back(client, member):
    workout = await start(client)
    response = await add_photo(client, workout["id"])
    assert response.status_code == 200
    url = response.json()["photo_url"]
    assert url.startswith(f"/api/workouts/{workout['id']}/photo?v=")
    picture = await client.get(url)
    assert picture.content.startswith(b"\xff\xd8\xff")
    assert picture.headers["content-type"] == "image/jpeg"
    assert picture.headers["x-content-type-options"] == "nosniff"
    assert (await client.get("/api/workouts/active")).json()["photo_url"] == url


async def test_saving_the_logger_keeps_the_photo(client, member):
    workout = await start(client)
    url = (await add_photo(client, workout["id"])).json()["photo_url"]
    saved = await client.put(f"/api/workouts/{workout['id']}", json={"exercises": [BENCH]})
    assert saved.json()["photo_url"] == url


async def test_a_photo_can_be_added_after_finishing(client, member):
    workout = await start(client)
    await finish(client, workout["id"])
    url = (await add_photo(client, workout["id"])).json()["photo_url"]
    detail = (await client.get(f"/api/me/workouts/{workout['id']}")).json()
    assert detail["photo_url"] == url


async def test_a_new_photo_replaces_it_with_a_new_url(client, member):
    workout = await start(client)
    first = (await add_photo(client, workout["id"])).json()["photo_url"]
    second = (await add_photo(client, workout["id"], PNG)).json()["photo_url"]
    assert first != second
    assert (await client.get(second)).content.startswith(b"\x89PNG")


async def test_a_photo_can_be_removed(client, member):
    workout = await start(client)
    url = (await add_photo(client, workout["id"])).json()["photo_url"]
    removed = await client.delete(f"/api/workouts/{workout['id']}/photo")
    assert removed.status_code == 200
    assert removed.json()["photo_url"] is None
    assert (await client.get(url)).status_code == 404


async def test_what_isnt_a_picture_is_refused(client, member):
    workout = await start(client)
    response = await add_photo(client, workout["id"], b"<svg onload=alert(1)>")
    assert response.status_code == 415


async def test_too_big_is_refused(client, member):
    workout = await start(client)
    response = await add_photo(client, workout["id"], JPEG + b"x" * (2 * 1024 * 1024))
    assert response.status_code == 413


async def test_your_crew_sees_it_on_the_feed(client, other_client, crew, member):
    await register_on(other_client, "maxo@example.com", crew.invite_code)
    workout = await start(client)
    url = (await add_photo(client, workout["id"])).json()["photo_url"]
    await finish(client, workout["id"])
    feed = (await other_client.get("/api/feed")).json()["items"]
    post = next(i for i in feed if i["kind"] == "workout")
    assert post["photo_url"] == url
    assert (await other_client.get(url)).content.startswith(b"\xff\xd8\xff")


async def test_a_photo_added_later_shows_on_the_post(client, member):
    workout = await start(client)
    await finish(client, workout["id"])
    url = (await add_photo(client, workout["id"])).json()["photo_url"]
    feed = (await client.get("/api/feed")).json()["items"]
    assert next(i for i in feed if i["kind"] == "workout")["photo_url"] == url


async def test_a_post_without_a_photo_says_so(client, member):
    workout = await start(client)
    await finish(client, workout["id"])
    feed = (await client.get("/api/feed")).json()["items"]
    assert next(i for i in feed if i["kind"] == "workout")["photo_url"] is None


async def test_someone_else_cant_change_your_photo(client, other_client, crew, member):
    await register_on(other_client, "maxo@example.com", crew.invite_code)
    workout = await start(client)
    assert (await add_photo(other_client, workout["id"])).status_code == 404
    assert (await other_client.delete(f"/api/workouts/{workout['id']}/photo")).status_code == 404


async def test_someone_outside_your_crew_cant_see_it(client, other_client, member, db_session):
    from db.repositories.crew_repository import CrewRepository
    from services.crew_service import CrewService

    other = await CrewService(CrewRepository(db_session)).create("Other", "UTC", "OTHERCREW")
    await register_on(other_client, "stranger@example.com", other.invite_code)
    workout = await start(client)
    url = (await add_photo(client, workout["id"])).json()["photo_url"]
    assert (await other_client.get(url)).status_code == 404
