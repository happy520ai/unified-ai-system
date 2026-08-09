using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

internal static class Program
{
    private const string DefaultBaseUrl = "http://127.0.0.1:3100";
    private const string DefaultInput = "Help me plan a small API for my team";
    private const string DefaultProfile = "planning";
    private const string DefaultLanguage = "en";
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(10);
    private static readonly HashSet<string> SupportedProfiles = new(StringComparer.Ordinal)
    {
        "auto", "general", "coding", "analysis", "writing", "research", "planning",
    };
    private static readonly HashSet<string> SupportedLanguages = new(StringComparer.Ordinal)
    {
        "auto", "zh-CN", "en",
    };
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
    };

    private sealed record Options(string BaseUrl, string Input, string Profile, string Language, bool Help);

    private sealed record Envelope<T>(string? Status, T? Data);

    private sealed record HealthData(string? Status, bool? RealProviderEnabled);

    private sealed record EnhancementData(
        string? Original,
        string? EnhancedPrompt,
        string? Profile,
        string? Language,
        Metadata? Metadata);

    private sealed record Metadata(
        string? Engine,
        bool ProviderCalled,
        bool CredentialRequired,
        bool Deterministic);

    private static async Task<int> Main(string[] args)
    {
        try
        {
            var options = ParseArgs(args);
            if (options.Help)
            {
                Console.Write(Usage());
                return 0;
            }

            using var client = new HttpClient { Timeout = RequestTimeout };
            var health = await RequestJsonAsync<Envelope<HealthData>>(
                client,
                HttpMethod.Get,
                BuildUri(options.BaseUrl, "/health/check"),
                null);
            RequireProviderFreeHealth(health);

            var enhancement = await RequestJsonAsync<Envelope<EnhancementData>>(
                client,
                HttpMethod.Post,
                BuildUri(options.BaseUrl, "/prompts/enhance"),
                new
                {
                    input = options.Input,
                    profile = options.Profile,
                    language = options.Language,
                });
            RequireProviderFreeEnhancement(enhancement, options.Input);

            Console.WriteLine(JsonSerializer.Serialize(enhancement.Data, JsonOptions));
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine($"Prompt enhancement example failed: {error.Message}");
            return 1;
        }
    }

    private static Options ParseArgs(string[] args)
    {
        var baseUrl = DefaultBaseUrl;
        var profile = DefaultProfile;
        var language = DefaultLanguage;
        var inputParts = new List<string>();
        var help = false;

        for (var index = 0; index < args.Length; index++)
        {
            var argument = args[index];
            if (argument == "--help")
            {
                help = true;
                continue;
            }

            if (argument == "--")
            {
                inputParts.AddRange(args[(index + 1)..]);
                break;
            }

            if (argument is "--base-url" or "--profile" or "--language")
            {
                if (index + 1 >= args.Length || args[index + 1].StartsWith("--", StringComparison.Ordinal))
                {
                    throw new ArgumentException($"{argument} requires a value.");
                }

                var value = args[++index];
                ApplyOption(argument, value, ref baseUrl, ref profile, ref language);
                continue;
            }

            if (argument.StartsWith("--base-url=", StringComparison.Ordinal))
            {
                baseUrl = argument["--base-url=".Length..];
                continue;
            }

            if (argument.StartsWith("--profile=", StringComparison.Ordinal))
            {
                profile = argument["--profile=".Length..];
                continue;
            }

            if (argument.StartsWith("--language=", StringComparison.Ordinal))
            {
                language = argument["--language=".Length..];
                continue;
            }

            if (argument.StartsWith("-", StringComparison.Ordinal))
            {
                throw new ArgumentException($"Unknown option: {argument}");
            }

            inputParts.Add(argument);
        }

        var input = string.Join(' ', inputParts).Trim();
        if (input.Length == 0)
        {
            input = DefaultInput;
        }

        if (!SupportedProfiles.Contains(profile))
        {
            throw new ArgumentException($"Unsupported profile: {profile}");
        }

        if (!SupportedLanguages.Contains(language))
        {
            throw new ArgumentException($"Unsupported language: {language}");
        }

        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var parsedUrl)
            || parsedUrl.Scheme is not ("http" or "https")
            || string.IsNullOrWhiteSpace(parsedUrl.Host))
        {
            throw new ArgumentException("The gateway URL must use http or https.");
        }

        return new Options(baseUrl.TrimEnd('/'), input, profile, language, help);
    }

    private static void ApplyOption(
        string option,
        string value,
        ref string baseUrl,
        ref string profile,
        ref string language)
    {
        switch (option)
        {
            case "--base-url":
                baseUrl = value;
                break;
            case "--profile":
                profile = value;
                break;
            case "--language":
                language = value;
                break;
        }
    }

    private static string Usage() =>
        "Usage: dotnet run --project docs/examples/prompt-enhancement.csproj -- [input] [options]\n\n"
        + "Options:\n"
        + $"  --base-url <url>       Gateway URL (default: {DefaultBaseUrl})\n"
        + $"  --profile <profile>    Enhancement profile (default: {DefaultProfile})\n"
        + $"  --language <language>  Output language (default: {DefaultLanguage})\n"
        + "  --help                 Show this message\n";

    private static Uri BuildUri(string baseUrl, string path) =>
        new($"{baseUrl.TrimEnd('/')}/{path.TrimStart('/')}");

    private static async Task<T> RequestJsonAsync<T>(
        HttpClient client,
        HttpMethod method,
        Uri endpoint,
        object? payload)
    {
        using var request = new HttpRequestMessage(method, endpoint);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (payload is not null)
        {
            var json = JsonSerializer.Serialize(payload);
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }

        using var response = await client.SendAsync(request);
        var rawBody = await response.Content.ReadAsStringAsync();
        T? result;
        try
        {
            result = JsonSerializer.Deserialize<T>(rawBody, JsonOptions);
        }
        catch (JsonException error)
        {
            throw new InvalidOperationException(
                $"{endpoint.AbsolutePath} returned invalid JSON: {error.Message}");
        }

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"{endpoint.AbsolutePath} returned HTTP {(int)response.StatusCode}: {rawBody.Trim()}");
        }

        return result ?? throw new InvalidOperationException(
            $"{endpoint.AbsolutePath} returned an empty JSON response.");
    }

    private static void RequireProviderFreeHealth(Envelope<HealthData> response)
    {
        if (response.Status != "ok"
            || response.Data?.Status != "ready"
            || response.Data.RealProviderEnabled is not false)
        {
            throw new InvalidOperationException(
                "Refusing to continue: gateway is not ready in explicit provider-free mode.");
        }
    }

    private static void RequireProviderFreeEnhancement(
        Envelope<EnhancementData> response,
        string input)
    {
        var data = response.Data;
        var metadata = data?.Metadata;
        if (response.Status != "ok"
            || data?.Original != input
            || string.IsNullOrWhiteSpace(data.EnhancedPrompt)
            || !data.EnhancedPrompt.Contains(input, StringComparison.Ordinal)
            || metadata?.Engine != "local-deterministic"
            || metadata.ProviderCalled
            || metadata.CredentialRequired
            || !metadata.Deterministic)
        {
            throw new InvalidOperationException(
                "The response did not prove local deterministic prompt enhancement.");
        }
    }
}
