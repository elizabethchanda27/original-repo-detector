import json
import unittest
from urllib.parse import parse_qs, urlparse

from original_repo_detector.cli import main
from original_repo_detector.detect import detect
from original_repo_detector.github import GitHubClient, GitHubError
from original_repo_detector.parse import parse_repo


def repo(**overrides):
    record = {
        "full_name": "acme/widget",
        "description": "A widget",
        "html_url": "https://github.com/acme/widget",
        "created_at": "2026-02-01T00:00:00Z",
        "pushed_at": "2026-10-01T00:00:00Z",
        "stargazers_count": 3,
        "forks_count": 1,
        "open_issues_count": 0,
        "language": "Python",
        "license": {"spdx_id": "MIT"},
        "fork": False,
        "default_branch": "main",
    }
    record.update(overrides)
    return record


class RecordingClient(GitHubClient):
    def __init__(self, record, readme="2026-10-21T00:00:00Z"):
        super().__init__()
        self.record = record
        self.readme = readme
        self.calls = []

    def get_repo(self, full_name):
        self.calls.append(("repo", full_name))
        if isinstance(self.record, Exception):
            raise self.record
        return self.record

    def readme_pushed_at(self, full_name):
        self.calls.append(("readme", full_name))
        return self.readme


class ParseTests(unittest.TestCase):
    def test_owner_name(self):
        self.assertEqual(parse_repo(" HKUDS/nanobot "), "HKUDS/nanobot")

    def test_url_drops_extra_path(self):
        self.assertEqual(
            parse_repo("https://github.com/Maxmount/hkuds-nanobot/tree/main"),
            "Maxmount/hkuds-nanobot",
        )

    def test_rejects_other_hosts(self):
        with self.assertRaises(ValueError):
            parse_repo("https://gitlab.com/a/b")


class DetectTests(unittest.TestCase):
    def test_original_when_fork_is_false_and_there_is_no_template(self):
        result = detect("acme/widget", client=RecordingClient(repo()))
        self.assertEqual(result.outcome, "original")
        self.assertEqual(result.headline, "GitHub records this as the original.")
        self.assertIn("fork field is false", result.detail)
        self.assertIn("GitHub stores no template repository.", " ".join(result.facts))
        self.assertIn("October 21, 2026", " ".join(result.facts))

    def test_fork_uses_the_parent_from_the_repository_record(self):
        record = repo(
            full_name="Maxmount/hkuds-nanobot",
            fork=True,
            parent={"full_name": "HKUDS/nanobot"},
            source={"full_name": "openclaw/openclaw"},
        )
        result = detect("Maxmount/hkuds-nanobot", client=RecordingClient(record, readme=None))
        self.assertEqual(result.outcome, "fork")
        self.assertEqual(result.parent, "HKUDS/nanobot")
        self.assertIn("is a fork of HKUDS/nanobot.", result.detail)
        self.assertIn("The recorded root of that line is openclaw/openclaw.", result.detail)

    def test_template_field_names_the_earlier_repository(self):
        record = repo(
            full_name="Break-Through-Tech/Microsoft-3B-github-repo-trust-signals",
            template_repository={"full_name": "Break-Through-Tech/Microsoft-3A-github-repo-trust-signals"},
        )
        result = detect(record["full_name"], client=RecordingClient(record, readme=None))
        self.assertEqual(result.outcome, "template")
        self.assertEqual(result.template, "Break-Through-Tech/Microsoft-3A-github-repo-trust-signals")
        self.assertEqual(result.headline, "GitHub records this as generated from a template.")

    def test_missing_repository(self):
        result = detect("octocat/missing", client=RecordingClient(None))
        self.assertEqual(result.outcome, "not_found")
        self.assertEqual(result.headline, "That repository was not found.")
        self.assertEqual(result.facts, [])

    def test_rate_limit_is_returned_as_unreadable(self):
        error = GitHubError("GitHub's hourly limit was reached. A personal access token raises that limit.", 403)
        result = detect("acme/widget", client=RecordingClient(error))
        self.assertEqual(result.outcome, "unreadable")
        self.assertIn("hourly limit", result.detail)

    def test_a_sentence_in_the_record_does_not_change_the_outcome(self):
        record = repo(description="An alternative to OpenClaw, inspired by Clawdbot")
        result = detect("acme/widget", client=RecordingClient(record, readme=None))
        self.assertEqual(result.outcome, "original")


class ClientTests(unittest.TestCase):
    def test_client_reads_the_repository_endpoint_and_the_readme_date(self):
        def opener(url, token=None):
            parsed = urlparse(url)
            if parsed.path == "/repos/acme/widget":
                return 200, repo()
            if parsed.path == "/repos/acme/widget/commits":
                self.assertEqual(parse_qs(parsed.query)["path"], ["README.md"])
                return 200, [{"commit": {"author": {"date": "2026-10-21T12:00:00Z"}}}]
            raise AssertionError(url)

        result = detect("acme/widget", client=GitHubClient(opener=opener))
        self.assertEqual(result.outcome, "original")
        self.assertEqual(result.readme_pushed_at, "2026-10-21T12:00:00Z")

    def test_client_turns_a_404_into_no_record(self):
        def opener(url, token=None):
            return 404, None

        self.assertIsNone(GitHubClient(opener=opener).get_repo("acme/missing"))


class CliTests(unittest.TestCase):
    def test_command_prints_the_library_result(self):
        from io import StringIO
        from unittest import mock

        detection = detect("acme/widget", client=RecordingClient(repo(), readme=None))
        with mock.patch("original_repo_detector.cli.detect", return_value=detection):
            output = StringIO()
            with mock.patch("sys.stdout", output):
                code = main(["acme/widget"])
        self.assertEqual(code, 0)
        self.assertIn("GitHub records this as the original.", output.getvalue())

    def test_command_can_print_json(self):
        from io import StringIO
        from unittest import mock

        detection = detect("acme/widget", client=RecordingClient(repo(), readme=None))
        with mock.patch("original_repo_detector.cli.detect", return_value=detection):
            output = StringIO()
            with mock.patch("sys.stdout", output):
                code = main(["acme/widget", "--json"])
        self.assertEqual(code, 0)
        payload = json.loads(output.getvalue())
        self.assertEqual(payload["outcome"], "original")
        self.assertEqual(payload["fork"], False)


if __name__ == "__main__":
    unittest.main()
