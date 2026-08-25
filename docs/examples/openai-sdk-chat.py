#!/usr/bin/env python3

"""Official OpenAI Python SDK smoke test against a local fake-provider gateway."""

import argparse
import json
import os
import sys


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Run a tiny OpenAI Python SDK compatibility check against the local"
            " gateway without provider keys."
        )
    )
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:3100",
        help="Gateway base URL for /v1 endpoints",
    )
    return parser.parse_args()


def model_dump(value, fallback=None):
    try:
        method = getattr(value, "model_dump")
        return method(mode="json")
    except AttributeError:
        return fallback


def main() -> int:
    args = parse_args()
    base_url = args.base_url.rstrip("/")

    try:
        from importlib.metadata import version
        from openai import BadRequestError, OpenAI
    except ModuleNotFoundError as error:
        print(
            json.dumps(
                {
                    "ok": False,
                    "skipped": True,
                    "reason": (
                        "openai package is not installed. Install it first with"
                        " `py -m pip install openai`."
                    ),
                    "client": "openai-python",
                    "error": str(error),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0

    client = OpenAI(
        api_key=os.getenv("PME_AUTH_TOKEN", "local-development"),
        base_url=f"{base_url}/v1",
        max_retries=0,
    )

    try:
        models = client.models.list()
        completion = client.chat.completions.create(
            model="local-fake-model",
            messages=[{"role": "user", "content": "Official OpenAI Python SDK compatibility test"}],
        )

        enhanced = client.chat.completions.create(
            model="local-fake-model",
            messages=[{"role": "user", "content": "Build a Node API with tests"}],
            extra_body={
                "unified_ai": {
                "prompt_enhancement": {
                    "enabled": True,
                    "profile": "coding",
                    "language": "en",
                }
                }
            },
        )

        legacy = client.completions.create(
            model="local-fake-model",
            prompt="Legacy OpenAI Python SDK completion compatibility test",
        )
        legacy_stream = client.completions.create(
            model="local-fake-model",
            prompt="Stream through legacy completions endpoint",
            stream=True,
        )
        legacy_stream_text = ""
        for chunk in legacy_stream:
            text = getattr(chunk.choices[0], "text", None) if chunk.choices else None
            if isinstance(text, str):
                legacy_stream_text += text

        stream = client.chat.completions.create(
            model="local-fake-model",
            messages=[
                {"role": "user", "content": "Stream through the official OpenAI Python SDK"},
            ],
            stream=True,
        )
        stream_content = ""
        stream_metadata = None
        for chunk in stream:
            choice = chunk.choices[0] if chunk.choices else None
            delta = getattr(choice.delta, "content", None) if choice else None
            if isinstance(delta, str):
                stream_content += delta
            if stream_metadata is None:
                stream_metadata = getattr(chunk, "unified_ai", None)
                if stream_metadata is None:
                    stream_metadata = (getattr(chunk, "model_extra", None) or {}).get("unified_ai")

        response = client.responses.create(
            model="local-fake-model",
            instructions="Answer briefly",
            input="Official OpenAI Python SDK Responses compatibility test",
            store=False,
        )

        response_stream = client.responses.create(
            model="local-fake-model",
            input="Stream through the official Responses SDK in Python",
            store=False,
            stream=True,
        )
        response_stream_text = ""
        response_stream_completed = False
        for event in response_stream:
            if getattr(event, "type", None) == "response.output_text.delta":
                response_stream_text += getattr(event, "delta", "")
            if getattr(event, "type", None) == "response.completed":
                response_stream_completed = True

        invalid_request = {}
        try:
            client.chat.completions.create(
                model="local-fake-model",
                messages=[{"role": "user", "content": "Reject unsupported n"}],
                n=2,
            )
        except BadRequestError as error:
            invalid_request = {
                "name": error.__class__.__name__,
                "status": getattr(error, "status_code", None),
                "code": getattr(error, "code", None),
                "param": getattr(error, "param", None),
                "type": getattr(error, "type", None),
            }

        model_info = model_dump(models) or {}
        model = next(
            (
                candidate
                for candidate in model_info.get("data", [])
                if candidate.get("id") == "local-fake-model"
            ),
            None,
        )
        completion_data = model_dump(completion) or {}
        enhanced_data = model_dump(enhanced) or {}
        legacy_data = model_dump(legacy) or {}
        response_data = model_dump(response) or {}
        stream_metadata_data = (
            stream_metadata
            if isinstance(stream_metadata, dict)
            else model_dump(stream_metadata, {})
        )

        checks = {
            "modelList":
                model is not None
                and model.get("owned_by") == "local-fake-provider",
            "completion":
                completion_data.get("object") == "chat.completion"
                and completion_data.get("model") == "local-fake-model"
                and "compatibility test" in (
                    completion_data.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                ),
            "enhanced":
                enhanced_data.get("unified_ai", {}).get("prompt_enhancement", {}).get(
                    "applied",
                )
                is True,
            "stream":
                "Stream through the official OpenAI Python SDK" in stream_content,
            "responses":
                response_data.get("object") == "response"
                and response_data.get("status") == "completed",
            "responsesStream": response_stream_completed,
            "streamMetadata":
                stream_metadata_data.get("execution_mode") == "fake",
            "provider":
                completion_data.get("unified_ai", {}).get("execution_mode") == "fake"
                and completion_data.get("unified_ai", {}).get("selected_provider")
                == "local-fake-provider",
            "legacy_completion":
                legacy_data.get("object") == "text_completion"
                and "[fake:local-fake-provider/local-fake-model]"
                in legacy_data.get("choices", [{}])[0].get("text", ""),
            "legacy_stream":
                len(legacy_stream_text) > 0
                and "[fake:local-fake-provider/local-fake-model]" in legacy_stream_text,
        }
        checks_ok = all(checks.values()) and invalid_request.get("type") == "invalid_request_error"
        result = {
            "ok": bool(checks_ok),
            "client": "openai-python",
            "sdkVersion": "unknown",
            "baseUrl": f"{base_url}/v1",
            "checks": checks,
            "model": model.get("id") if model else None,
            "executionMode": completion_data.get("unified_ai", {}).get("execution_mode"),
            "invalidRequest": invalid_request,
            "realProviderCallsMade": False,
        }
        try:
            result["sdkVersion"] = version("openai")
        except Exception:
            pass
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result["ok"] else 1
    except Exception as error:
        print(
            json.dumps(
                {
                    "ok": False,
                    "client": "openai-python",
                    "error": str(error),
                    "realProviderCallsMade": False,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
