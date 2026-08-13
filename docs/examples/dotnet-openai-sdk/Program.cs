using System.ClientModel;
using System.Text.Json;
using OpenAI;
using OpenAI.Chat;

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

var baseUrl = GetBaseUrl(args);
var client = new ChatClient(
    model: "local-fake-model",
    credential: new ApiKeyCredential("local-development"),
    options: new OpenAIClientOptions
    {
        Endpoint = new Uri($"{baseUrl}/v1"),
    });
var completion = await client.CompleteChatAsync("OpenAI .NET SDK runtime test");
var content = completion.Value.Content.FirstOrDefault()?.Text ?? "";
var checks = new
{
    content = content.Contains("OpenAI .NET SDK runtime test", StringComparison.Ordinal),
    fakeProvider = content.Contains("[fake:local-fake-provider/local-fake-model]", StringComparison.Ordinal),
    finishReason = completion.Value.FinishReason == ChatFinishReason.Stop,
};
var ok = checks.content && checks.fakeProvider && checks.finishReason;
Console.WriteLine(JsonSerializer.Serialize(new
{
    client = "openai-dotnet",
    sdk = "OpenAI 2.13.0",
    baseUrl,
    checks,
    ok,
    realProviderCallsMade = false,
}));
return ok ? 0 : 1;
