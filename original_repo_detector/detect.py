"""Decide whether GitHub records a repository as the original, a fork, or a template."""

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

from original_repo_detector.github import GitHubClient, GitHubError
from original_repo_detector.parse import parse_repo


@dataclass
class Detection:
    """The result of one check. outcome is original, fork, template, not_found, or unreadable."""

    repo: str
    outcome: str
    headline: str
    detail: str
    fork: bool = None
    parent: str = None
    source: str = None
    template: str = None
    html_url: str = None
    description: str = None
    stars: int = None
    forks_count: int = None
    open_issues: int = None
    language: str = None
    license: str = None
    created_at: str = None
    pushed_at: str = None
    readme_pushed_at: str = None
    facts: list = field(default_factory=list)

    def to_dict(self):
        return asdict(self)


def detect(repo, token=None, client=None):
    """Check one repository against GitHub's public API.

    repo is owner/name or a github.com link. token is optional. It stays with
    the caller and only raises GitHub's hourly request limit.

    Example:
        result = detect("owner/name")
        result.outcome
    """
    full_name = parse_repo(repo)
    github = client or GitHubClient(token)
    try:
        record = github.get_repo(full_name)
    except GitHubError as error:
        return _unreadable(full_name, str(error))
    if record is None:
        return Detection(
            repo=full_name,
            outcome="not_found",
            headline="That repository was not found.",
            detail=f"{full_name} was not found on GitHub. It may be private or renamed.",
        )

    try:
        readme_pushed_at = github.readme_pushed_at(record.get("full_name") or full_name)
    except GitHubError:
        readme_pushed_at = None
    return _from_record(record, readme_pushed_at)


def _unreadable(full_name, detail):
    return Detection(
        repo=full_name,
        outcome="unreadable",
        headline="That repository could not be read.",
        detail=detail,
    )


def _name(value):
    if isinstance(value, dict):
        return value.get("full_name") or None
    return None


def _license(record):
    license_info = record.get("license") or {}
    spdx = license_info.get("spdx_id")
    if not spdx or spdx == "NOASSERTION":
        return None
    return spdx


def _from_record(record, readme_pushed_at):
    full_name = record.get("full_name")
    is_fork = bool(record.get("fork"))
    parent = _name(record.get("parent"))
    source = _name(record.get("source"))
    template = _name(record.get("template_repository"))
    outcome, headline, detail = _verdict(full_name, is_fork, parent, source, template)
    created_at = record.get("created_at")
    pushed_at = record.get("pushed_at")
    return Detection(
        repo=full_name,
        outcome=outcome,
        headline=headline,
        detail=detail,
        fork=is_fork,
        parent=parent,
        source=source,
        template=template,
        html_url=record.get("html_url"),
        description=record.get("description") or None,
        stars=record.get("stargazers_count"),
        forks_count=record.get("forks_count"),
        open_issues=record.get("open_issues_count"),
        language=record.get("language") or None,
        license=_license(record),
        created_at=created_at,
        pushed_at=pushed_at,
        readme_pushed_at=readme_pushed_at,
        facts=_facts(full_name, is_fork, parent, template, created_at, pushed_at, readme_pushed_at),
    )


def _verdict(full_name, is_fork, parent, source, template):
    if is_fork and parent:
        root = ""
        if source and source.lower() != parent.lower():
            root = f" The recorded root of that line is {source}."
        return (
            "fork",
            "GitHub records this as a fork.",
            f"{full_name} is a fork of {parent}.{root}",
        )
    if template:
        return (
            "template",
            "GitHub records this as generated from a template.",
            (
                f"{full_name} was generated from {template}. The fork field is false. "
                "The template is the earlier repository on GitHub's record."
            ),
        )
    return (
        "original",
        "GitHub records this as the original.",
        "The fork field is false, and GitHub stores no template repository. "
        "Those are the public fields that name an earlier repository.",
    )


def _format_date(iso):
    if not iso:
        return "date not recorded"
    text = str(iso).replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return "date not recorded"
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    parsed = parsed.astimezone(timezone.utc)
    return f"{parsed.strftime('%B')} {parsed.day}, {parsed.year}"


def _facts(full_name, is_fork, parent, template, created_at, pushed_at, readme_pushed_at):
    facts = [
        f"{full_name} exists on GitHub. This was read from the repository record.",
        (
            f"GitHub's fork field is true. The parent is {parent}."
            if is_fork
            else "GitHub's fork field is false."
        ),
        (
            f"GitHub's template field names {template}."
            if template
            else "GitHub stores no template repository."
        ),
        (
            f"The repository was created on {_format_date(created_at)} "
            f"and last pushed on {_format_date(pushed_at)}."
        ),
    ]
    if readme_pushed_at:
        facts.append(f"The current README last changed on {_format_date(readme_pushed_at)}.")
    return facts
