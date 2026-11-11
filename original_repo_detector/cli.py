"""Command-line wrapper. It parses the arguments and prints what the library returns."""

import argparse
import json
import os
import sys

from original_repo_detector.detect import detect


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="original-repo-detector",
        description="Check whether GitHub records a repository as the original, a fork, or generated from a template.",
    )
    parser.add_argument("repo", help="owner/name or a github.com link")
    parser.add_argument(
        "--token",
        help="GitHub personal access token. Defaults to the GITHUB_TOKEN environment variable.",
    )
    parser.add_argument("--json", action="store_true", help="Print the library result as JSON.")
    args = parser.parse_args(argv)
    token = args.token or os.environ.get("GITHUB_TOKEN") or None

    try:
        result = detect(args.repo, token=token)
    except ValueError as error:
        print(error, file=sys.stderr)
        return 2

    if args.json:
        print(json.dumps(result.to_dict(), indent=2))
    else:
        print(result.headline)
        print()
        print(result.detail)
    if result.outcome in {"not_found", "unreadable"}:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
