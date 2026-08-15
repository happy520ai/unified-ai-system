#!/usr/bin/env python3

"""Run optional Python client profiles against a credential-free gateway."""

from __future__ import annotations

import argparse
import asyncio
from importlib.metadata import version as package_version
import json
import os
import subprocess
import sys
import uuid
from typing import Any, Callable


_DLL_DIRECTORY_HANDLES: list[Any] = []


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--client", default="http-python-requests")
    parser.add_argument("--base-url", default="http://127.0.0.1:3100")
    return parser.parse_args()


def prepare_windows_runtime() -> None:
    if sys.platform != "win32":
        return
    root = os.getenv("CLIENT_RUNTIME_PYTHON_ROOT")
    if not root:
        return
    paths = [
        root,
        os.path.join(root, "win32"),
        os.path.join(root, "win32", "lib"),
        os.path.join(root, "pywin32_system32"),
    ]
    for path in paths:
        if os.path.isdir(path) and path not in sys.path:
            sys.path.insert(0, path)
    add_dll_directory = getattr(os, "add_dll_directory", None)
    system_path = os.path.join(root, "pywin32_system32")
    if add_dll_directory and os.path.isdir(system_path):
        _DLL_DIRECTORY_HANDLES.append(add_dll_directory(system_path))


def result(client: str, sdk: str, checks: dict[str, bool], **extra: Any) -> int:
    payload = {
        "client": client,
        "sdk": sdk,
        "checks": checks,
        "ok": all(checks.values()),
        "realProviderCallsMade": False,
        **extra,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2, default=str))
    return 0 if payload["ok"] else 1


def request_payload(base_url: str) -> tuple[int, dict[str, Any], int, dict[str, Any]]:
    import requests

    models = requests.get(f"{base_url}/v1/models", timeout=30)
    chat = requests.post(
        f"{base_url}/v1/chat/completions",
        json={
            "model": "local-fake-model",
            "messages": [{"role": "user", "content": "Python requests runtime test"}],
        },
        timeout=30,
    )
    return models.status_code, models.json(), chat.status_code, chat.json()


def run_requests(base_url: str) -> int:
    models_status, models, chat_status, chat = request_payload(base_url)
    return result(
        "http-python-requests",
        "requests",
        {
            "models": models_status == 200
            and any(item.get("id") == "local-fake-model" for item in models.get("data", [])),
            "chat": chat_status == 200 and chat.get("object") == "chat.completion",
            "fakeProvider": chat.get("unified_ai", {}).get("execution_mode") == "fake",
            "content": "Python requests runtime test"
            in chat.get("choices", [{}])[0].get("message", {}).get("content", ""),
        },
    )


def run_httpie(base_url: str) -> int:
    payload = json.dumps({
        "model": "local-fake-model",
        "messages": [{"role": "user", "content": "HTTPie runtime test"}],
    })
    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "httpie",
            "--check-status",
            "--ignore-stdin",
            "--print=b",
            "POST",
            f"{base_url}/v1/chat/completions",
            "Content-Type:application/json",
            "--raw",
            payload,
        ],
        capture_output=True,
        check=False,
        env=os.environ.copy(),
        text=True,
        timeout=60,
    )
    body: dict[str, Any] = {}
    try:
        body = json.loads(completed.stdout.strip())
    except json.JSONDecodeError:
        pass
    return result(
        "http-httpie",
        "httpie",
        {
            "exitCode": completed.returncode == 0,
            "chat": body.get("object") == "chat.completion",
            "fakeProvider": body.get("unified_ai", {}).get("execution_mode") == "fake",
            "content": "HTTPie runtime test"
            in body.get("choices", [{}])[0].get("message", {}).get("content", ""),
        },
        stderr=completed.stderr[-1000:],
    )


async def run_httpx(base_url: str) -> int:
    import httpx

    async with httpx.AsyncClient(timeout=30) as client:
        models = await client.get(f"{base_url}/v1/models")
        chat = await client.post(
            f"{base_url}/v1/chat/completions",
            json={
                "model": "local-fake-model",
                "messages": [{"role": "user", "content": "Python httpx runtime test"}],
            },
        )
    models_data = models.json()
    chat_data = chat.json()
    return result(
        "http-python-httpx",
        "httpx",
        {
            "models": models.status_code == 200
            and any(item.get("id") == "local-fake-model" for item in models_data.get("data", [])),
            "chat": chat.status_code == 200 and chat_data.get("object") == "chat.completion",
            "fakeProvider": chat_data.get("unified_ai", {}).get("execution_mode") == "fake",
            "content": "Python httpx runtime test"
            in chat_data.get("choices", [{}])[0].get("message", {}).get("content", ""),
        },
    )


async def run_aiohttp(base_url: str) -> int:
    from aiohttp import ClientSession

    async with ClientSession() as client:
        async with client.get(f"{base_url}/v1/models") as models_response:
            models_status = models_response.status
            models = await models_response.json()
        async with client.post(
            f"{base_url}/v1/chat/completions",
            json={
                "model": "local-fake-model",
                "messages": [{"role": "user", "content": "Python aiohttp runtime test"}],
            },
        ) as chat_response:
            chat_status = chat_response.status
            chat = await chat_response.json()
    return result(
        "http-python-aiohttp",
        "aiohttp",
        {
            "models": models_status == 200
            and any(item.get("id") == "local-fake-model" for item in models.get("data", [])),
            "chat": chat_status == 200 and chat.get("object") == "chat.completion",
            "fakeProvider": chat.get("unified_ai", {}).get("execution_mode") == "fake",
            "content": "Python aiohttp runtime test"
            in chat.get("choices", [{}])[0].get("message", {}).get("content", ""),
        },
    )


async def run_a2a(base_url: str) -> int:
    from a2a.client import ClientConfig, ClientFactory
    from a2a.types import Message, Part, Role, SendMessageRequest, TaskState

    factory = ClientFactory(ClientConfig(streaming=False, polling=False))
    client = await factory.create_from_url(base_url)
    try:
        request = SendMessageRequest(
            message=Message(
                message_id=str(uuid.uuid4()),
                role=Role.ROLE_USER,
                parts=[Part(text="A2A Python SDK runtime test", media_type="text/plain")],
            )
        )
        responses = [response async for response in client.send_message(request)]
        task = responses[-1].task if responses and responses[-1].HasField("task") else None
        output = ""
        if task is not None:
            output = " ".join(
                part.text
                for artifact in task.artifacts
                for part in artifact.parts
                if part.text
            )
        state = task.status.state if task is not None else None
        return result(
            "a2a-python",
            "a2a-sdk",
            {
                "task": task is not None,
                "completed": state == TaskState.TASK_STATE_COMPLETED,
                "output": "A2A Python SDK runtime test" in output,
                "fakeProvider": "local-fake-provider" in str(task) if task is not None else False,
            },
            protocolVersion="1.0",
        )
    finally:
        await client.close()


async def run_mcp_python(base_url: str) -> int:
    prepare_windows_runtime()
    from mcp import ClientSession
    from mcp.client.stdio import StdioServerParameters, stdio_client

    repo_root = os.getenv("UNIFIED_AI_SYSTEM_REPO_ROOT", os.getcwd())
    node_command = os.getenv("AI_GATEWAY_NODE_EXECUTABLE", "node")
    server = os.path.join(repo_root, "packages", "mcp-server", "src", "index.js")
    server_parameters = StdioServerParameters(
        command=node_command,
        args=[server],
        cwd=repo_root,
        env={
            **os.environ,
            "AI_GATEWAY_MCP_URL": "",
            "AI_GATEWAY_PROVIDER_MODE": "fake",
            "AI_GATEWAY_REAL_PROVIDER_ENABLED": "false",
            "PME_ENTERPRISE_AUTH_ENABLED": "false",
        },
    )
    async with stdio_client(server_parameters) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            listed = await session.list_tools()
            health = await session.call_tool("gateway_health", {})
    health_text = json.dumps(health.model_dump(mode="json"), ensure_ascii=False, default=str)
    return result(
        "mcp-python-sdk",
        "mcp",
        {
            "tools": len(listed.tools) == 9,
            "health": not health.isError,
            "fakeProvider": "local-fake-provider" in health_text,
        },
    )


def run_litellm(base_url: str) -> int:
    from litellm import completion

    response = completion(
        model="openai/local-fake-model",
        api_base=f"{base_url}/v1",
        api_key="local-development",
        messages=[{"role": "user", "content": "LiteLLM OpenAI-compatible runtime test"}],
        num_retries=0,
    )
    content = response.choices[0].message.content or ""
    return result(
        "openai-litellm",
        "litellm",
        {
            "content": "LiteLLM OpenAI-compatible runtime test" in content,
            "model": response.model == "local-fake-model",
            "fakeProvider": getattr(response, "_hidden_params", {}).get("api_base") is not None
            or "[fake:local-fake-provider/local-fake-model]" in content,
        },
    )


async def run_pydantic_ai(base_url: str) -> int:
    from pydantic_ai import Agent
    from pydantic_ai.models.openai import OpenAIChatModel
    from pydantic_ai.providers.openai import OpenAIProvider

    model = OpenAIChatModel(
        "local-fake-model",
        provider=OpenAIProvider(
            base_url=f"{base_url}/v1",
            api_key="local-development",
        ),
    )
    agent = Agent(model)
    response = await agent.run("PydanticAI OpenAI-compatible runtime test")
    content = str(response.output)
    return result(
        "openai-pydantic-ai",
        "pydantic-ai",
        {
            "content": "PydanticAI OpenAI-compatible runtime test" in content,
            "output": bool(content),
            "fakeProvider": "[fake:local-fake-provider/local-fake-model]" in content,
        },
    )


async def run_autogen(base_url: str) -> int:
    from autogen_core.models import ModelFamily, UserMessage
    from autogen_ext.models.openai import OpenAIChatCompletionClient

    client = OpenAIChatCompletionClient(
        api_key="local-development",
        base_url=f"{base_url}/v1",
        max_retries=0,
        model="local-fake-model",
        model_info={
            "family": ModelFamily.UNKNOWN,
            "function_calling": False,
            "json_output": False,
            "structured_output": False,
            "vision": False,
        },
    )
    try:
        response = await client.create([
            UserMessage(content="AutoGen OpenAI-compatible runtime test", source="user"),
        ])
    finally:
        await client.close()
    content = response.content if isinstance(response.content, str) else str(response.content)
    return result(
        "openai-autogen",
        "autogen-agentchat + autogen-ext",
        {
            "content": "AutoGen OpenAI-compatible runtime test" in content,
            "finishReason": response.finish_reason == "stop",
            "fakeProvider": "[fake:local-fake-provider/local-fake-model]" in content,
        },
        sdkVersion=(
            f"agentchat {package_version('autogen-agentchat')}; "
            f"ext {package_version('autogen-ext')}"
        ),
    )


async def run_openai_agents(base_url: str) -> int:
    from agents import (
        Agent,
        OpenAIChatCompletionsModel,
        RunConfig,
        Runner,
        set_tracing_disabled,
    )
    from openai import AsyncOpenAI

    set_tracing_disabled(True)
    client = AsyncOpenAI(
        api_key="local-development",
        base_url=f"{base_url}/v1",
        max_retries=0,
    )
    model = OpenAIChatCompletionsModel(
        model="local-fake-model",
        openai_client=client,
    )
    agent = Agent(
        name="gateway-runtime",
        instructions="Return the local model response without calling tools.",
        model=model,
    )
    try:
        response = await Runner.run(
            agent,
            "OpenAI Agents SDK runtime test",
            max_turns=1,
            run_config=RunConfig(
                tracing_disabled=True,
                trace_include_sensitive_data=False,
            ),
        )
    finally:
        await client.close()
    content = str(response.final_output or "")
    return result(
        "openai-agents-python",
        "openai-agents",
        {
            "content": "OpenAI Agents SDK runtime test" in content,
            "completed": bool(content) and len(response.raw_responses) == 1,
            "lastAgent": response.last_agent.name == "gateway-runtime",
            "fakeProvider": "[fake:local-fake-provider/local-fake-model]" in content,
        },
        sdkVersion=package_version("openai-agents"),
    )


async def run_semantic_kernel(base_url: str) -> int:
    from openai import AsyncOpenAI
    from semantic_kernel.connectors.ai.open_ai import (
        OpenAIChatCompletion,
        OpenAIChatPromptExecutionSettings,
    )
    from semantic_kernel.contents import ChatHistory

    client = AsyncOpenAI(
        api_key="local-development",
        base_url=f"{base_url}/v1",
        max_retries=0,
    )
    service = OpenAIChatCompletion(
        ai_model_id="local-fake-model",
        async_client=client,
    )
    history = ChatHistory()
    history.add_user_message("Semantic Kernel OpenAI-compatible runtime test")
    try:
        response = await service.get_chat_message_content(
            history,
            OpenAIChatPromptExecutionSettings(
                ai_model_id="local-fake-model",
                max_tokens=256,
            ),
        )
    finally:
        await client.close()
    content = str(response.content) if response is not None else ""
    return result(
        "openai-semantic-kernel",
        "semantic-kernel",
        {
            "content": "Semantic Kernel OpenAI-compatible runtime test" in content,
            "responseType": response is not None
            and response.__class__.__name__ == "ChatMessageContent",
            "fakeProvider": "[fake:local-fake-provider/local-fake-model]" in content,
        },
    )


def run_dspy(base_url: str) -> int:
    import dspy

    model = dspy.LM(
        "openai/local-fake-model",
        api_base=f"{base_url}/v1",
        api_key="local-development",
        cache=False,
        max_tokens=256,
        num_retries=0,
    )
    response = model(prompt="DSPy OpenAI-compatible runtime test")
    content = response[0] if response and isinstance(response[0], str) else str(response)
    return result(
        "openai-dspy",
        "dspy",
        {
            "content": "DSPy OpenAI-compatible runtime test" in content,
            "responseType": isinstance(response, list) and len(response) == 1,
            "modelConfigured": model.model == "openai/local-fake-model",
            "fakeProvider": "[fake:local-fake-provider/local-fake-model]" in content,
        },
    )


def run_haystack(base_url: str) -> int:
    from haystack.components.generators.chat import OpenAIChatGenerator
    from haystack.dataclasses import ChatMessage
    from haystack.utils import Secret

    generator = OpenAIChatGenerator(
        api_key=Secret.from_token("local-development"),
        model="local-fake-model",
        api_base_url=f"{base_url}/v1",
        max_retries=0,
    )
    response = generator.run([
        ChatMessage.from_user("Haystack OpenAI-compatible runtime test"),
    ])
    replies = response.get("replies", [])
    reply = replies[0] if replies else None
    content = reply.text if reply is not None else ""
    return result(
        "openai-haystack",
        "haystack-ai",
        {
            "content": "Haystack OpenAI-compatible runtime test" in content,
            "singleReply": len(replies) == 1,
            "responseType": reply is not None
            and reply.__class__.__name__ == "ChatMessage",
            "fakeProvider": "[fake:local-fake-provider/local-fake-model]" in content,
        },
        sdkVersion=package_version("haystack-ai"),
    )


def run_langgraph(base_url: str) -> int:
    from langchain_openai import ChatOpenAI
    from langgraph.graph import END, START, StateGraph
    from typing_extensions import TypedDict

    class State(TypedDict):
        prompt: str
        output: str

    model = ChatOpenAI(
        api_key="local-development",
        base_url=f"{base_url}/v1",
        model="local-fake-model",
        max_retries=0,
    )

    def call_model(state: State) -> dict[str, str]:
        response = model.invoke(state["prompt"])
        return {"output": response.content if isinstance(response.content, str) else str(response.content)}

    graph = StateGraph(State)
    graph.add_node("model", call_model)
    graph.add_edge(START, "model")
    graph.add_edge("model", END)
    response = graph.compile().invoke({
        "prompt": "LangGraph OpenAI-compatible runtime test",
        "output": "",
    })
    content = response.get("output", "")
    return result(
        "openai-langgraph",
        "langgraph + langchain-openai",
        {
            "content": "LangGraph OpenAI-compatible runtime test" in content,
            "graphCompleted": bool(content),
        },
    )


def run_langchain(base_url: str) -> int:
    from langchain_openai import ChatOpenAI

    model = ChatOpenAI(
        api_key="local-development",
        base_url=f"{base_url}/v1",
        model="local-fake-model",
        max_retries=0,
    )
    response = model.invoke("LangChain Python OpenAI-compatible runtime test")
    content = response.content if isinstance(response.content, str) else str(response.content)
    metadata = getattr(response, "response_metadata", {}) or {}
    return result(
        "openai-langchain-py",
        "langchain-openai",
        {
            "content": "LangChain Python OpenAI-compatible runtime test" in content,
            "responseType": response.__class__.__name__ == "AIMessage",
            "finishReason": metadata.get("finish_reason") == "stop",
            "fakeProvider": "[fake:local-fake-provider/local-fake-model]" in content,
        },
    )


def run_llamaindex(base_url: str) -> int:
    from llama_index.core.base.llms.types import LLMMetadata
    from llama_index.llms.openai import OpenAI

    class LocalGatewayOpenAI(OpenAI):
        @property
        def metadata(self) -> LLMMetadata:
            return LLMMetadata(
                context_window=128_000,
                is_chat_model=True,
                is_function_calling_model=False,
                model_name=self.model,
                num_output=self.max_tokens or -1,
            )

    model = LocalGatewayOpenAI(
        api_key="local-development",
        api_base=f"{base_url}/v1",
        max_retries=0,
        model="local-fake-model",
    )
    response = model.complete("LlamaIndex Python OpenAI-compatible runtime test")
    content = str(response)
    return result(
        "openai-llamaindex-python",
        "llama-index-llms-openai",
        {
            "content": "LlamaIndex Python OpenAI-compatible runtime test" in content,
            "responseType": response.__class__.__name__ == "CompletionResponse",
            "fakeProvider": "[fake:local-fake-provider/local-fake-model]" in content,
        },
    )


def run_openai_root_alias(base_url: str) -> int:
    from openai import OpenAI

    client = OpenAI(
        api_key=os.getenv("PME_AUTH_TOKEN", "local-development"),
        base_url=base_url,
        max_retries=0,
    )
    models = client.models.list()
    chat = client.chat.completions.create(
        model="local-fake-model",
        messages=[{"role": "user", "content": "OpenAI Python root alias runtime test"}],
    )
    response = client.responses.create(
        model="local-fake-model",
        input="OpenAI Python root Responses alias runtime test",
        store=False,
    )
    models_data = models.model_dump(mode="json")
    chat_data = chat.model_dump(mode="json")
    response_data = response.model_dump(mode="json")
    return result(
        "openai-python-root-alias",
        "openai",
        {
            "models": any(item.get("id") == "local-fake-model" for item in models_data.get("data", [])),
            "chat": chat_data.get("object") == "chat.completion"
            and "OpenAI Python root alias runtime test"
            in chat_data.get("choices", [{}])[0].get("message", {}).get("content", ""),
            "responses": response_data.get("object") == "response"
            and response_data.get("status") == "completed",
            "fakeProvider": chat_data.get("unified_ai", {}).get("execution_mode") == "fake",
        },
    )


def run_azure_openai(base_url: str) -> int:
    from openai import AzureOpenAI

    client = AzureOpenAI(
        api_key=os.getenv("PME_AUTH_TOKEN", "local-development"),
        azure_endpoint=base_url,
        api_version="2024-10-21",
        max_retries=0,
    )
    completion = client.chat.completions.create(
        model="local-fake-model",
        messages=[{"role": "user", "content": "Azure OpenAI Python route runtime test"}],
    )
    data = completion.model_dump(mode="json")
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return result(
        "openai-azure-sdk-python-compat",
        "openai AzureOpenAI",
        {
            "chat": data.get("object") == "chat.completion",
            "deploymentRoute": data.get("model") == "local-fake-model",
            "content": "Azure OpenAI Python route runtime test" in content,
            "fakeProvider": data.get("unified_ai", {}).get("execution_mode") == "fake",
        },
    )


def run_instructor(base_url: str) -> int:
    import instructor
    from openai import OpenAI
    from pydantic import BaseModel

    class GatewayResult(BaseModel):
        message: str
        count: int
        ok: bool

    raw_client = OpenAI(
        api_key="local-development",
        base_url=f"{base_url}/v1",
        max_retries=0,
    )
    client = instructor.from_openai(raw_client, mode=instructor.Mode.JSON_SCHEMA)
    try:
        response = client.chat.completions.create(
            model="local-fake-model",
            response_model=GatewayResult,
            max_retries=0,
            messages=[{
                "role": "user",
                "content": "Instructor structured output runtime test",
            }],
        )
    finally:
        raw_client.close()
    return result(
        "openai-instructor",
        "instructor + openai",
        {
            "typedOutput": response.__class__.__name__ == "GatewayResult",
            "schemaValues": response.count == 1 and response.ok is True,
            "content": "Instructor structured output runtime test" in response.message,
            "fakeProvider": "[fake:local-fake-provider/local-fake-model]" in response.message,
        },
        sdkVersion=package_version("instructor"),
    )


def run_crewai(base_url: str) -> int:
    os.environ["OTEL_SDK_DISABLED"] = "true"
    os.environ["CREWAI_DISABLE_TELEMETRY"] = "true"
    os.environ["DO_NOT_TRACK"] = "1"
    os.environ["ANONYMIZED_TELEMETRY"] = "False"
    os.environ["CREWAI_TESTING"] = "true"

    from crewai import Agent, Crew, LLM, Process, Task
    from crewai.events.listeners.tracing.utils import set_suppress_tracing_messages

    set_suppress_tracing_messages(True)

    model = LLM(
        model="local-fake-model",
        base_url=f"{base_url}/v1",
        api_key="local-development",
        provider="openai",
        temperature=0,
        max_tokens=256,
        stream=False,
    )
    agent = Agent(
        role="Gateway runtime verifier",
        goal="Complete the assigned compatibility check without tools.",
        backstory="You return the local model response directly.",
        llm=model,
        verbose=False,
        allow_delegation=False,
        max_iter=1,
        max_retry_limit=0,
        memory=False,
    )
    task = Task(
        description="CrewAI OpenAI-compatible runtime test",
        expected_output="A short confirmation returned by the configured local gateway.",
        agent=agent,
    )
    response = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        verbose=False,
        memory=False,
        cache=False,
        share_crew=False,
        tracing=False,
    ).kickoff()
    content = str(getattr(response, "raw", response) or "")
    return result(
        "openai-crewai",
        "crewai",
        {
            "crewCompleted": bool(content),
            "content": "CrewAI OpenAI-compatible runtime test" in content,
            "fakeProvider": "[fake:local-fake-provider/local-fake-model]" in content,
            "telemetryDisabled": os.environ.get("CREWAI_DISABLE_TELEMETRY") == "true",
        },
        sdkVersion=package_version("crewai"),
    )


def run_guidance(base_url: str) -> int:
    from guidance import assistant, gen, system, user
    from guidance.models import OpenAI

    model = OpenAI(
        "local-fake-model",
        api_key="local-development",
        base_url=f"{base_url}/v1",
        echo=False,
        max_retries=0,
    )
    # Guidance enables optional token log probabilities by default. The gateway
    # profile intentionally requests plain text because it does not advertise logprobs.
    model._interpreter.logprobs = False
    model._interpreter.top_k = None
    with system():
        model += "Return the configured local gateway response."
    with user():
        model += "Guidance OpenAI-compatible runtime test"
    with assistant():
        model += gen(name="answer", max_tokens=96)
    content = str(model["answer"])
    return result(
        "openai-guidance",
        "guidance",
        {
            "generated": bool(content),
            "content": "Guidance OpenAI-compatible runtime test" in content,
            "fakeProvider": "[fake:local-fake-provider/local-fake-model]" in content,
            "plainTextProfile": model._interpreter.logprobs is False,
        },
        sdkVersion=package_version("guidance"),
    )


def main() -> int:
    args = parse_args()
    base_url = args.base_url.rstrip("/")
    runners: dict[str, Callable[[str], Any]] = {
        "http-python-requests": run_requests,
        "http-httpie": run_httpie,
        "http-python-httpx": run_httpx,
        "http-python-aiohttp": run_aiohttp,
        "openai-langchain-py": run_langchain,
        "openai-llamaindex-python": run_llamaindex,
        "a2a-python": run_a2a,
        "mcp-python-sdk": run_mcp_python,
        "openai-litellm": run_litellm,
        "openai-pydantic-ai": run_pydantic_ai,
        "openai-autogen": run_autogen,
        "openai-agents-python": run_openai_agents,
        "openai-semantic-kernel": run_semantic_kernel,
        "openai-dspy": run_dspy,
        "openai-haystack": run_haystack,
        "openai-langgraph": run_langgraph,
        "openai-python-root-alias": run_openai_root_alias,
        "openai-azure-sdk-python-compat": run_azure_openai,
        "openai-instructor": run_instructor,
        "openai-crewai": run_crewai,
        "openai-guidance": run_guidance,
    }
    runner = runners.get(args.client)
    if runner is None:
        raise SystemExit(f"Unknown Python client runtime profile: {args.client}")
    try:
        value = runner(base_url)
        if asyncio.iscoroutine(value):
            return asyncio.run(value)
        return int(value)
    except ModuleNotFoundError as error:
        print(json.dumps({
            "client": args.client,
            "skipped": True,
            "reason": f"Optional Python dependency is not installed: {error.name}",
            "error": str(error),
            "realProviderCallsMade": False,
        }, ensure_ascii=False, indent=2))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
