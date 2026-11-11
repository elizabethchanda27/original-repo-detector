import re


def parse_repo(raw):
    """Return owner/name. Raises ValueError when the input is not a GitHub repository."""
    text = str(raw or "").strip()
    if not text:
        raise ValueError("Enter a GitHub repository.")

    path = text
    if re.match(r"^https?://", text, re.IGNORECASE):
        from urllib.parse import urlparse

        try:
            url = urlparse(text)
        except ValueError as error:
            raise ValueError("That link could not be read.") from error
        host = url.hostname or ""
        if not re.search(r"(^|\.)github\.com$", host, re.IGNORECASE):
            raise ValueError("Use a github.com repository link.")
        path = url.path

    path = re.sub(r"^/", "", path)
    path = re.sub(r"\.git$", "", path)
    path = re.sub(r"/$", "", path)
    parts = [part for part in path.split("/") if part]
    if len(parts) < 2:
        raise ValueError("Enter a repository as owner/name or a GitHub link.")
    owner, repo = parts[0], parts[1]
    if not re.fullmatch(r"[\w.-]+", owner) or not re.fullmatch(r"[\w.-]+", repo):
        raise ValueError("Enter a repository as owner/name or a GitHub link.")
    return f"{owner}/{repo}"
