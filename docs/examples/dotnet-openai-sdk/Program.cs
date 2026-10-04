using System.ClientModel;
using System.Text.Json;
using OpenAI;
using OpenAI.Chat;

// The parser moved to ExampleHelpers.cs so the MSTest cases in this project cover the same code the
// demo runs (T-111). Only the call site changed.
var baseUrl = ExampleHelpers.GetBaseUrl(args);
var client = new ChatClient(
    model: "local-fake-model",
    credential: new ApiKeyCredential("local-development"),
    options: new OpenAIClientOptions
    {
        Endpoint = new Uri(ExampleHelpers.SdkEndpoint(baseUrl)),
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
