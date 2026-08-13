// Command openai-go-chat performs a compact OpenAI-compatible smoke test using
// Go's standard library only (no third-party SDK dependency).
// It intentionally verifies the route matrix and fake-provider metadata used by
// mainstream OpenAI-compatible clients.
//
// Usage:
//   go run docs/examples/openai-go-chat.go --base-url http://127.0.0.1:3100

package main

import (
  "bytes"
  "encoding/json"
  "errors"
  "fmt"
  "io"
  "net/http"
  "context"
  "os"
  "strings"
  "time"
)

const (
  defaultBaseURL = "http://127.0.0.1:3100"
  fakeModel      = "local-fake-model"
  timeoutMs      = 12 * time.Second
)

type checkSet map[string]bool

type checksResult struct {
  Ok                  bool      `json:"ok"`
  Error               string    `json:"error,omitempty"`
  Client              string    `json:"client"`
  BaseURL             string    `json:"baseUrl"`
  Checks              checkSet  `json:"checks"`
  ModelCount          int       `json:"modelCount"`
  ExecutionMode       string    `json:"executionMode,omitempty"`
  RealProviderCallsMade bool     `json:"realProviderCallsMade"`
}

type jsonObject map[string]any

func main() {
  args := parseArgs(os.Args[1:])
  result := checksResult{
    Client: "openai-go",
    BaseURL: args.baseURL,
    Checks: make(checkSet),
    RealProviderCallsMade: false,
  }

  client := &http.Client{
    Timeout: timeoutMs,
  }

  checks := checkSet{}
  if err := runAllChecks(context.Background(), client, args.baseURL, fakeModel, checks, &result); err != nil {
    result.Ok = false
    result.Error = err.Error()
  } else {
    result.Ok = allChecksPassed(checks)
  }
  result.Checks = checks

  output, encodeErr := json.MarshalIndent(result, "", "  ")
  if encodeErr != nil {
    fallback, _ := json.Marshal(map[string]any{
      "ok": false,
      "error": encodeErr.Error(),
      "client": "openai-go",
      "baseUrl": args.baseURL,
      "checks": checkSet{},
      "realProviderCallsMade": false,
    })
    fmt.Println(string(fallback))
    os.Exit(1)
  }

  fmt.Println(string(output))
  if !result.Ok {
    os.Exit(1)
  }
}

func runAllChecks(ctx context.Context, client *http.Client, baseURL, model string, checks checkSet, result *checksResult) error {
  health, err := requestJSON(client, ctx, "GET", baseURL+"/health/check", nil)
  if err != nil {
    return err
  }
  statusValue, _ := jsonAsString(health, "status")
  checks["health"] = statusValue == "ok"
  checks["healthReady"] = statusValue == "ok"

  modelsRaw, err := requestJSON(client, ctx, "GET", baseURL+"/v1/models", nil)
  if err != nil {
    return err
  }
  models := asJSONArray(modelsRaw, "data")
  result.ModelCount = len(models)
  modelData := firstModelByID(models, model)
  checks["models"] = modelData != nil
  if modelData != nil {
    result.ExecutionMode, _ = jsonAsString(modelData, "unified_ai", "execution_mode")
    checks["modelExecutionMode"] = result.ExecutionMode == "fake"
  } else {
    checks["modelExecutionMode"] = false
  }

  chat := map[string]any{
    "model":    model,
    "messages": []any{map[string]any{"role": "user", "content": "Go native compatibility test"}},
  }
  chatRaw, err := requestJSON(client, ctx, "POST", baseURL+"/v1/chat/completions", chat)
  if err != nil {
    return err
  }
  checks["chat"] = hasUnifiedExecutionMode(chatRaw, "fake")
  checks["chatContent"] = hasTextInChoices(chatRaw, "go compatibility test", "message.content")
  checks["chatModelMatch"] = stringFieldEquals(chatRaw, "model", model)

  legacy := map[string]any{
    "model": model,
    "prompt": "Legacy completion compatibility from Go",
  }
  legacyRaw, err := requestJSON(client, ctx, "POST", baseURL+"/v1/completions", legacy)
  if err != nil {
    return err
  }
  checks["legacyCompletion"] = hasUnifiedExecutionMode(legacyRaw, "fake")
  checks["legacyText"] = hasTextInChoices(legacyRaw, "[fake:local-fake-provider/local-fake-model]", "text")

  responses, err := requestJSON(client, ctx, "POST", baseURL+"/v1/responses", map[string]any{
    "model": model,
    "instructions": "Responses compatibility test from Go",
    "input": "Responses compatibility test from Go",
    "store": false,
  })
  if err != nil {
    return err
  }
  checks["responses"] = hasUnifiedExecutionMode(responses, "fake")
  checks["responsesOutputText"] = hasOutputTextContains(responses, "Responses compatibility test from Go")
  checks["responsesObject"] = stringFieldEquals(responses, "object", "response")
  checks["responsesStatus"] = stringFieldEquals(responses, "status", "completed")

  aliasChat, err := requestJSON(client, ctx, "POST", baseURL+"/chat/completions", map[string]any{
    "model":    model,
    "messages": []any{map[string]any{"role": "user", "content": "Alias chat route compatibility"}},
  })
  if err != nil {
    return err
  }
  checks["chatAlias"] = hasUnifiedExecutionMode(aliasChat, "fake")

  aliasResponses, err := requestJSON(client, ctx, "POST", baseURL+"/responses", map[string]any{
    "model": model,
    "instructions": "Alias responses route compatibility",
    "input": "alias responses test",
    "store": false,
  })
  if err != nil {
    return err
  }
  checks["responsesAlias"] = hasUnifiedExecutionMode(aliasResponses, "fake")

  azureChat, err := requestJSON(client, ctx, "POST", baseURL+"/openai/deployments/"+model+"/chat/completions", map[string]any{
    "messages": []any{map[string]any{"role": "user", "content": "Azure-style alias check"}},
  })
  if err != nil {
    return err
  }
  checks["azureChatAlias"] = hasUnifiedExecutionMode(azureChat, "fake")

  legacyEngine, err := requestJSON(client, ctx, "POST", baseURL+"/v1/engines/"+model+"/completions", map[string]any{
    "prompt": "Engine legacy compatibility check",
  })
  if err != nil {
    return err
  }
  checks["engineCompletions"] = hasUnifiedExecutionMode(legacyEngine, "fake")

  streamChatText, err := requestText(client, ctx, "POST", baseURL+"/v1/chat/completions", map[string]any{
    "model": model,
    "messages": []any{map[string]any{"role": "user", "content": "Stream through Go"}},
    "stream": true,
  })
  if err != nil {
    return err
  }
  checks["streamChatSse"] = strings.Contains(streamChatText, "data: [DONE]")
  checks["streamChatContent"] = strings.Contains(streamChatText, "[DONE]") && strings.Contains(streamChatText, "Stream through Go")

  streamResponseText, err := requestText(client, ctx, "POST", baseURL+"/v1/responses", map[string]any{
    "model": model,
    "instructions": "Stream responses from Go",
    "input": "stream output check",
    "stream": true,
    "store": false,
  })
  if err != nil {
    return err
  }
  checks["streamResponsesSse"] = strings.Contains(streamResponseText, "response.completed")
  checks["streamResponsesDone"] = strings.Contains(streamResponseText, "data: [DONE]")

  return nil
}

type scriptArgs struct {
  baseURL string
}

func parseArgs(args []string) scriptArgs {
  result := scriptArgs{
    baseURL: defaultBaseURL,
  }
  if len(args) >= 2 && (args[0] == "--base-url" || args[0] == "-b") {
    result.baseURL = normalizeBaseURL(args[1])
    return result
  }
  if len(args) >= 1 && (args[0] == "--help" || args[0] == "-h") {
    fmt.Fprintln(os.Stderr, "Usage: go run docs/examples/openai-go-chat.go --base-url <url>")
    os.Exit(1)
  }
  if len(args) > 0 && strings.HasPrefix(args[0], "--base-url=") {
    result.baseURL = normalizeBaseURL(strings.TrimPrefix(args[0], "--base-url="))
    return result
  }
  if len(args) > 0 && strings.TrimSpace(args[0]) != "" && !strings.HasPrefix(args[0], "--") {
    result.baseURL = normalizeBaseURL(args[0])
  }
  return result
}

func normalizeBaseURL(value string) string {
  normalized := strings.TrimSpace(value)
  if normalized == "" {
    return defaultBaseURL
  }
  if strings.HasSuffix(normalized, "/") {
    return strings.TrimRight(normalized, "/")
  }
  return normalized
}

func requestJSON(client *http.Client, ctx context.Context, method, url string, body any) (jsonObject, error) {
  responseText, err := requestText(client, ctx, method, url, body)
  if err != nil {
    return nil, err
  }
  if responseText == "" {
    return nil, errors.New("empty JSON response")
  }
  var parsed jsonObject
  if err := json.Unmarshal([]byte(responseText), &parsed); err != nil {
    return nil, err
  }
  return parsed, nil
}

func requestText(client *http.Client, ctx context.Context, method, url string, body any) (string, error) {
  var requestBody io.Reader
  if body != nil {
    encoded, err := json.Marshal(body)
    if err != nil {
      return "", err
    }
    requestBody = bytes.NewBuffer(encoded)
  }

  request, err := http.NewRequestWithContext(ctx, method, url, requestBody)
  if err != nil {
    return "", err
  }
  if body != nil {
    request.Header.Set("content-type", "application/json")
  }
  if method == "GET" {
    request.Header.Del("content-type")
  }

  response, err := client.Do(request)
  if err != nil {
    return "", err
  }
  defer response.Body.Close()
  rawBody, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
  if err != nil {
    return "", err
  }
  if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
    return "", fmt.Errorf("http %d: %s", response.StatusCode, strings.TrimSpace(string(rawBody)))
  }
  return string(rawBody), nil
}

func asJSONArray(value jsonObject, field string) []jsonObject {
  array, ok := value[field]
  if !ok {
    return nil
  }
  raw, ok := array.([]any)
  if !ok {
    return nil
  }
  models := make([]jsonObject, 0, len(raw))
  for _, item := range raw {
    if model, ok := item.(map[string]any); ok {
      models = append(models, model)
    }
  }
  return models
}

func firstModelByID(models []jsonObject, modelID string) jsonObject {
  for _, model := range models {
    id, ok := jsonAsStringSilent(model, "id")
    if ok && id == modelID {
      return model
    }
  }
  return nil
}

func hasUnifiedExecutionMode(response jsonObject, expectedMode string) bool {
  unified, ok := response["unified_ai"].(map[string]any)
  if !ok {
    return false
  }
  mode, _ := unified["execution_mode"].(string)
  return mode == expectedMode
}

func hasTextInChoices(response jsonObject, expected string, path string) bool {
  _, exists := response["choices"]
  if !exists {
    return false
  }
  choices, ok := response["choices"].([]any)
  if !ok || len(choices) == 0 {
    return false
  }
  firstChoice, ok := choices[0].(map[string]any)
  if !ok {
    return false
  }

  value, found := readTextInChoice(firstChoice, path)
  if !found {
    return false
  }
  return strings.Contains(value, expected)
}

func hasOutputTextContains(response jsonObject, expected string) bool {
  outputText, found := response["output_text"]
  if !found {
    return false
  }
  value, ok := outputText.(string)
  return ok && strings.Contains(value, expected)
}

func stringFieldEquals(response jsonObject, field string, expected string) bool {
  value, ok := response[field].(string)
  return ok && value == expected
}

func readTextInChoice(choice map[string]any, path string) (string, bool) {
  switch path {
  case "message.content":
    message, ok := choice["message"].(map[string]any)
    if !ok {
      return "", false
    }
    value, ok := message["content"].(string)
    return value, ok
  case "text":
    value, ok := choice["text"].(string)
    return value, ok
  default:
    return "", false
  }
}

func jsonAsString(value jsonObject, path ...string) (string, bool) {
  if len(path) == 0 {
    return "", false
  }
  current := any(value)
  for _, segment := range path {
    object, ok := current.(map[string]any)
    if !ok {
      return "", false
    }
    next, exists := object[segment]
    if !exists {
      return "", false
    }
    current = next
  }
  text, ok := current.(string)
  return text, ok
}

func jsonAsStringSilent(value jsonObject, key string) (string, bool) {
  raw, ok := value[key]
  if !ok {
    return "", false
  }
  text, ok := raw.(string)
  return text, ok
}

func allChecksPassed(checks checkSet) bool {
  required := len(checks)
  passed := 0
  for _, value := range checks {
    if value {
      passed++
    }
  }
  return required > 0 && passed == required
}
