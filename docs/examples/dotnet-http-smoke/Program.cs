using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

static string GetBaseUrl(string[] args)
{
    for (var index = 0; index + 1 < args.Length; index++)
    {
        if (args[index] == "--base-url")
        {
            return args[index + 1].TrimEnd('/');
        }
    }

    return "http://127.0.0.1:3100";
}

static bool HasFakeExecution(JsonDocument document)
{
    return document.RootElement.TryGetProperty("unified_ai", out var unified)
        && unified.TryGetProperty("execution_mode", out var mode)
        && mode.GetString() == "fake";
}

var baseUrl = GetBaseUrl(args);
using var client = new HttpClient();
client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

using var modelsResponse = await client.GetAsync($"{baseUrl}/v1/models");
using var modelsDocument = JsonDocument.Parse(await modelsResponse.Content.ReadAsStringAsync());
var modelFound = modelsDocument.RootElement.TryGetProperty("data", out var models)
    && models.EnumerateArray().Any(model =>
        model.TryGetProperty("id", out var id) && id.GetString() == "local-fake-model"
        && model.TryGetProperty("owned_by", out var owner) && owner.GetString() == "local-fake-provider");

var chatJson = "{\"model\":\"local-fake-model\",\"messages\":[{\"role\":\"user\",\"content\":\".NET HttpClient runtime test\"}]}";
using var chatResponse = await client.PostAsync(
    $"{baseUrl}/v1/chat/completions",
    new StringContent(chatJson, Encoding.UTF8, "application/json"));
using var chatDocument = JsonDocument.Parse(await chatResponse.Content.ReadAsStringAsync());
var chatObject = chatDocument.RootElement.TryGetProperty("object", out var objectValue)
    && objectValue.GetString() == "chat.completion";
var content = chatDocument.RootElement
    .GetProperty("choices")[0]
    .GetProperty("message")
    .GetProperty("content")
    .GetString() ?? "";
var contentFound = content.Contains(".NET HttpClient runtime test", StringComparison.Ordinal);
var checks = new
{
    models = modelsResponse.IsSuccessStatusCode && modelFound,
    chat = chatResponse.IsSuccessStatusCode && chatObject,
    fakeProvider = HasFakeExecution(chatDocument),
    content = contentFound,
};
var ok = checks.models && checks.chat && checks.fakeProvider && checks.content;
Console.WriteLine(JsonSerializer.Serialize(new
{
    client = "http-dotnet-httpclient",
    sdk = "System.Net.Http.HttpClient",
    baseUrl,
    checks,
    ok,
    realProviderCallsMade = false,
}));
return ok ? 0 : 1;
