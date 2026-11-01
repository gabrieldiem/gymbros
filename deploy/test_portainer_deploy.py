"""portainer-deploy.sh against a fake Portainer that behaves like the real one.

The fake copies what matters from Portainer 2.45 (api/http/handler/stacks/stack_update.go): an update
validates the stack file's required variables before touching containers, and an update of a stack in
the error state runs `compose down` first, even if the deploy then fails.

Run: python3 deploy/test_portainer_deploy.py
"""

import json
import os
import re
import subprocess
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "portainer-deploy.sh")
OLD = "old-sha"
NEW = "new-sha"
OLD_FILE = "services:\n  api:\n    image: api:${IMAGE_TAG:?tag}\n    password: ${SECRET:?set it}\n"
NEW_FILE = OLD_FILE + "    google: ${GOOGLE_ID:?set it}\n"
STARTING_ENV = {"IMAGE_TAG": OLD, "SECRET": "s3cret"}
ACTIVE, FAILED = 1, 4


class FakePortainer:
    """The stack's state, and which image tags fail or never get healthy."""

    def __init__(self, env=None):
        self.env = dict(STARTING_ENV if env is None else env)
        self.file = OLD_FILE
        self.status = ACTIVE
        self.message = ""
        self.containers_tag = OLD  # None once the containers are gone
        self.fail_tags = set()
        self.unhealthy_tags = set()
        self.updates = []

    def update(self, payload):
        self.updates.append(payload)
        if self.status == FAILED:
            self.containers_tag = None  # Portainer's undeploy before redeploying
        self.env = {item["name"]: item["value"] for item in payload["env"]}
        self.file = payload["stackFileContent"]
        missing = [
            name
            for name in re.findall(r"\$\{(\w+):\?", self.file)
            if not self.env.get(name)
        ]
        tag = self.env["IMAGE_TAG"]
        if missing or tag in self.fail_tags:
            self.status, self.message = FAILED, f"stack config file is invalid: {missing}"
            return
        self.status, self.message = ACTIVE, ""
        self.containers_tag = tag

    def containers(self):
        if self.containers_tag is None:
            return []
        status = "Up (unhealthy)" if self.containers_tag in self.unhealthy_tags else "Up (healthy)"
        return [
            {
                "Labels": {
                    "com.docker.compose.project": "gymbros",
                    "com.docker.compose.service": service,
                },
                "Status": status,
                "Image": image,
            }
            for service, image in (
                ("postgres", "postgres:18"),
                ("api", f"api:{self.containers_tag}"),
                ("web", f"web:{self.containers_tag}"),
            )
        ]

    def healthy(self):
        return self.containers_tag is not None and self.containers_tag not in self.unhealthy_tags


def _handler(portainer):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def _reply(self, code, body):
            data = json.dumps(body, separators=(",", ":")).encode()
            self.send_response(code)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):  # pylint: disable=invalid-name
            path = self.path.split("?")[0]
            if path == "/api/stacks/1":
                env = [{"name": k, "value": v} for k, v in portainer.env.items()]
                status = [{"Status": portainer.status, "Message": portainer.message}]
                self._reply(200, {"Env": env, "DeploymentStatus": status})
            elif path == "/api/stacks/1/file":
                self._reply(200, {"StackFileContent": portainer.file})
            elif path == "/api/endpoints/1/docker/containers/json":
                self._reply(200, portainer.containers())
            elif path == "/health" and portainer.healthy():
                self._reply(200, {"status": "running", "database": "up"})
            else:
                self._reply(503, {})

        def do_PUT(self):  # pylint: disable=invalid-name
            length = int(self.headers["Content-Length"])
            portainer.update(json.loads(self.rfile.read(length)))
            self._reply(200, {})

    return Handler


class DeployTest(unittest.TestCase):
    def _deploy(self, portainer, stack_file=NEW_FILE):
        server = ThreadingHTTPServer(("127.0.0.1", 0), _handler(portainer))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        url = f"http://127.0.0.1:{server.server_address[1]}"
        with tempfile.NamedTemporaryFile("w", suffix=".yaml") as compose:
            compose.write(stack_file)
            compose.flush()
            env = {
                **os.environ,
                "PORTAINER_URL": url,
                "PORTAINER_API_KEY": "key",
                "PORTAINER_STACK_ID": "1",
                "PORTAINER_ENDPOINT_ID": "1",
                "APP_HEALTH_URL": f"{url}/health",
                "COMPOSE_FILE": compose.name,
                "POLL_SECONDS": "0",
            }
            return subprocess.run(
                [SCRIPT, NEW], env=env, capture_output=True, text=True, timeout=60, check=False
            )

    def test_a_healthy_deploy_goes_live(self):
        portainer = FakePortainer({**STARTING_ENV, "GOOGLE_ID": "id"})
        result = self._deploy(portainer)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertEqual(portainer.containers_tag, NEW)
        self.assertEqual(portainer.file, NEW_FILE)
        self.assertEqual(portainer.env["SECRET"], "s3cret")

    def test_a_missing_variable_changes_nothing(self):
        """The 2026-11-01 outage: GOOGLE_CLIENT_ID wasn't set in Portainer."""
        portainer = FakePortainer()
        result = self._deploy(portainer)
        self.assertEqual(result.returncode, 1)
        self.assertIn("GOOGLE_ID", result.stdout)
        self.assertEqual(portainer.updates, [])
        self.assertEqual(portainer.containers_tag, OLD)
        self.assertEqual(portainer.status, ACTIVE)

    def test_an_empty_variable_counts_as_missing(self):
        portainer = FakePortainer({**STARTING_ENV, "GOOGLE_ID": ""})
        result = self._deploy(portainer)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(portainer.updates, [])

    def test_a_failed_deploy_restores_the_previous_tag_and_file(self):
        portainer = FakePortainer({**STARTING_ENV, "GOOGLE_ID": "id"})
        portainer.fail_tags = {NEW}
        result = self._deploy(portainer)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(portainer.containers_tag, OLD)
        self.assertEqual(portainer.env["IMAGE_TAG"], OLD)
        self.assertEqual(portainer.file, OLD_FILE)
        self.assertEqual(portainer.status, ACTIVE)
        self.assertIn("is live and healthy", result.stdout)

    def test_unhealthy_containers_restore_the_previous_version(self):
        portainer = FakePortainer({**STARTING_ENV, "GOOGLE_ID": "id"})
        portainer.unhealthy_tags = {NEW}
        result = self._deploy(portainer)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(portainer.containers_tag, OLD)
        self.assertIn("restored", result.stdout)

    def test_a_failed_restore_is_reported_as_a_possible_outage(self):
        portainer = FakePortainer({**STARTING_ENV, "GOOGLE_ID": "id"})
        portainer.fail_tags = {NEW, OLD}
        result = self._deploy(portainer)
        self.assertEqual(result.returncode, 1)
        self.assertIn("the site may be down", result.stdout)
        self.assertNotIn("is live and healthy", result.stdout)

    def test_a_restore_that_never_gets_healthy_is_not_called_restored(self):
        portainer = FakePortainer({**STARTING_ENV, "GOOGLE_ID": "id"})
        portainer.unhealthy_tags = {NEW, OLD}
        result = self._deploy(portainer)
        self.assertEqual(result.returncode, 1)
        self.assertIn("the site may be down", result.stdout)
        self.assertNotIn("is live and healthy", result.stdout)

    def test_a_first_deploy_has_nothing_to_restore(self):
        portainer = FakePortainer({"SECRET": "s3cret", "GOOGLE_ID": "id"})
        portainer.fail_tags = {NEW}
        result = self._deploy(portainer)
        self.assertEqual(result.returncode, 1)
        self.assertIn("Nothing older to restore", result.stdout)
        self.assertEqual(len(portainer.updates), 1)


if __name__ == "__main__":
    unittest.main()
