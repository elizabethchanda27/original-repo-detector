"""Read a repository from GitHub's public REST API."""

import json
import ssl
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import certifi

API = "https://api.github.com"


class GitHubError(Exception):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


def _headers(token):
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "original-repo-detector",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def fetch_json(url, token=None):
    """Return (status, body) from GitHub. A 404 body is empty."""
    request = Request(url, headers=_headers(token))
    try:
        context = ssl.create_default_context(cafile=certifi.where())
        with urlopen(request, timeout=30, context=context) as response:
            raw = response.read().decode()
            body = json.loads(raw) if raw else None
            return response.status, body
    except HTTPError as error:
        raw = error.read().decode()
        try:
            body = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            body = {}
        message = body.get("message") if isinstance(body, dict) else None
        if error.code == 404:
            return 404, None
        if error.code == 403 and message and "rate limit" in message.lower():
            message = "GitHub's hourly limit was reached. A personal access token raises that limit."
        if not message:
            message = f"GitHub returned {error.code}."
        raise GitHubError(message, error.code) from error
    except URLError as error:
        raise GitHubError("GitHub could not be reached.") from error


class GitHubClient:
    """The two GitHub calls the check needs: the repository record, and the README date."""

    def __init__(self, token=None, opener=None):
        self.token = token or None
        self._open = opener or fetch_json

    def get_repo(self, full_name):
        status, body = self._open(f"{API}/repos/{full_name}", self.token)
        if status == 404 or body is None:
            return None
        return body

    def readme_pushed_at(self, full_name):
        for path in ("README.md", "readme.md"):
            query = urlencode({"path": path, "per_page": "1"})
            status, body = self._open(f"{API}/repos/{full_name}/commits?{query}", self.token)
            if status == 404 or not body:
                continue
            if isinstance(body, list) and body:
                commit = body[0].get("commit") or {}
                author = (commit.get("author") or {}).get("date")
                committer = (commit.get("committer") or {}).get("date")
                return author or committer
        return None
