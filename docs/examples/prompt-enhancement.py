#!/usr/bin/env python3
"""Call the provider-free prompt-enhancement endpoint with the stdlib only."""

import argparse
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


PROFILES = ("auto", "general", "coding", "analysis", "writing", "research", "planning")
LANGUAGES = ("auto", "zh-CN", "en")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Preview deterministic prompt enhancement without a provider key."
    )
    parser.add_argument(
        "input",
        nargs="?",
        default="Help me plan a small API for my team",
        help="Natural-language request to enhance.",
    )
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:3100",
        help="Gateway base URL (default: http://127.0.0.1:3100).",
    )
    parser.add_argument("--profile", choices=PROFILES, default="planning")
    parser.add_argument("--language", choices=LANGUAGES, default="en")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    payload = json.dumps(
        {
            "input": args.input,
            "profile": args.profile,
            "language": args.language,
        }
    ).encode("utf-8")
    request = Request(
        f"{args.base_url.rstrip('/')}/prompts/enhance",
        data=payload,
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=10) as response:
            raw_body = response.read().decode("utf-8")
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        print(f"HTTP {error.code}: {detail}", file=sys.stderr)
        return 1
    except URLError as error:
        print(f"Could not reach gateway: {error.reason}", file=sys.stderr)
        return 1

    try:
        result = json.loads(raw_body)
    except json.JSONDecodeError:
        print("Gateway returned invalid JSON.", file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
