// Real cases for the example's own guardrails: argument parsing, URL building, and the two
// "refuse to claim success" validators. These are the parts that decide whether a green run really
// means "the local fake provider answered", so they are worth testing without a gateway.
//
// They live in the same assembly on purpose -- widening the helpers from `private` to `internal`
// is the whole change (see the comment on each), and the example's behaviour is untouched.
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace PromptEnhancementExample.Tests;

[TestClass]
public sealed class OptionsParsingTests
{
    [TestMethod]
    public void DefaultsMatchTheDocumentedInvocation()
    {
        var options = Program.ParseArgs(Array.Empty<string>());
        Assert.AreEqual("http://127.0.0.1:3100", options.BaseUrl);
        Assert.AreEqual("planning", options.Profile);
        Assert.AreEqual("en", options.Language);
        Assert.AreEqual("Help me plan a small API for my team", options.Input);
        Assert.IsFalse(options.Help);
    }

    [TestMethod]
    public void FreeTextBecomesTheInputAndEverythingIsPositional()
    {
        var options = Program.ParseArgs(new[] { "make", "a", "plan" });
        Assert.AreEqual("make a plan", options.Input);
    }

    [TestMethod]
    public void EverythingAfterTheDoubleDashIsTheInputEvenIfItLooksLikeAFlag()
    {
        var options = Program.ParseArgs(new[] { "--", "--profile", "coding" });
        Assert.AreEqual("--profile coding", options.Input);
        // the flag must NOT have been consumed as an option
        Assert.AreEqual("planning", options.Profile);
    }

    [TestMethod]
    public void EqualsFormAndSeparateFormAgree()
    {
        var separated = Program.ParseArgs(new[] { "--profile", "coding", "--language", "zh-CN" });
        var equals = Program.ParseArgs(new[] { "--profile=coding", "--language=zh-CN" });
        Assert.AreEqual("coding", separated.Profile);
        Assert.AreEqual("zh-CN", separated.Language);
        Assert.AreEqual(equals.Profile, separated.Profile);
        Assert.AreEqual(equals.Language, separated.Language);
    }

    [TestMethod]
    public void BaseUrlIsNormalisedAndAccepted()
    {
        var options = Program.ParseArgs(new[] { "--base-url", "https://gateway.example.test/" });
        Assert.AreEqual("https://gateway.example.test", options.BaseUrl);
    }

    [TestMethod]
    public void HelpIsParsedButValidatesEverythingElseFirst()
    {
        // Measured behaviour, not intent: ParseArgs closes the whole option set BEFORE Main looks at
        // Help, so `--help` next to a bad profile is still refused. Pinned here so a future
        // short-circuit is a visible change rather than a surprise.
        var options = Program.ParseArgs(new[] { "--help" });
        Assert.IsTrue(options.Help);
        Assert.ThrowsException<ArgumentException>(
            () => Program.ParseArgs(new[] { "--help", "--profile", "not-a-profile" }));
    }

    [TestMethod]
    public void AFlagMissingItsValueIsRefusedRatherThanSilentlyDefaulted()
    {
        Assert.ThrowsException<ArgumentException>(() => Program.ParseArgs(new[] { "--profile" }));
        Assert.ThrowsException<ArgumentException>(() => Program.ParseArgs(new[] { "--profile", "--language", "en" }));
    }

    [TestMethod]
    public void AnUnknownFlagIsRefused()
    {
        Assert.ThrowsException<ArgumentException>(() => Program.ParseArgs(new[] { "--nope" }));
    }

    [TestMethod]
    public void AnUnsupportedProfileOrLanguageIsRefused()
    {
        Assert.ThrowsException<ArgumentException>(() => Program.ParseArgs(new[] { "--profile", "telepathy" }));
        Assert.ThrowsException<ArgumentException>(() => Program.ParseArgs(new[] { "--language", "xx-YY" }));
    }

    [TestMethod]
    public void ANonHttpUrlIsRefused()
    {
        Assert.ThrowsException<ArgumentException>(() => Program.ParseArgs(new[] { "--base-url", "ftp://gateway.example.test" }));
        Assert.ThrowsException<ArgumentException>(() => Program.ParseArgs(new[] { "--base-url", "not a url" }));
    }

    [TestMethod]
    public void UsageNamesEveryDocumentedFlag()
    {
        var usage = Program.Usage();
        foreach (var flag in new[] { "--base-url", "--profile", "--language", "--help" })
        {
            StringAssert.Contains(usage, flag);
        }
    }
}

[TestClass]
public sealed class UrlBuildingTests
{
    [TestMethod]
    public void SlashesAreNotDoubledOnEitherSide()
    {
        Assert.AreEqual(
            new Uri("http://127.0.0.1:3100/prompts/enhance"),
            Program.BuildUri("http://127.0.0.1:3100/", "/prompts/enhance"));
        Assert.AreEqual(
            new Uri("http://127.0.0.1:3100/health/check"),
            Program.BuildUri("http://127.0.0.1:3100", "health/check"));
    }
}

[TestClass]
public sealed class ProviderFreeGuardTests
{
    private static Program.Envelope<Program.HealthData> Health(string status, string? dataStatus, bool? realProvider)
        => new(status, new Program.HealthData(dataStatus, realProvider));

    [TestMethod]
    public void ProviderFreeHealthIsAccepted()
    {
        Program.RequireProviderFreeHealth(Health("ok", "ready", false));
    }

    [TestMethod]
    public void HealthThatEnablesARealProviderIsRefused()
    {
        Assert.ThrowsException<InvalidOperationException>(
            () => Program.RequireProviderFreeHealth(Health("ok", "ready", true)));
    }

    [TestMethod]
    public void HealthThatIsNotReadyIsRefused()
    {
        Assert.ThrowsException<InvalidOperationException>(
            () => Program.RequireProviderFreeHealth(Health("ok", "starting", false)));
        Assert.ThrowsException<InvalidOperationException>(
            () => Program.RequireProviderFreeHealth(Health("error", "ready", false)));
    }

    private static Program.Envelope<Program.EnhancementData> Enhancement(string input)
        => new("ok", new Program.EnhancementData(
            input,
            $"Structured plan for: {input}",
            "planning",
            "en",
            new Program.Metadata("local-deterministic", false, false, true)));

    [TestMethod]
    public void ALocalDeterministicEnhancementIsAccepted()
    {
        Program.RequireProviderFreeEnhancement(Enhancement("plan the API"), "plan the API");
    }

    [TestMethod]
    public void AnEnhancementThatDropsTheOriginalInputIsRefused()
    {
        var response = new Program.Envelope<Program.EnhancementData>(
            "ok",
            new Program.EnhancementData("something else", "Structured plan", "planning", "en",
                new Program.Metadata("local-deterministic", false, false, true)));
        Assert.ThrowsException<InvalidOperationException>(
            () => Program.RequireProviderFreeEnhancement(response, "plan the API"));
    }

    [TestMethod]
    public void AnEnhancementThatCalledAProviderIsRefused()
    {
        var response = new Program.Envelope<Program.EnhancementData>(
            "ok",
            new Program.EnhancementData("plan the API", "Structured plan", "planning", "en",
                new Program.Metadata("local-deterministic", true, false, true)));
        Assert.ThrowsException<InvalidOperationException>(
            () => Program.RequireProviderFreeEnhancement(response, "plan the API"));
    }

    [TestMethod]
    public void AnEnhancementFromAnUnknownEngineIsRefused()
    {
        var response = new Program.Envelope<Program.EnhancementData>(
            "ok",
            new Program.EnhancementData("plan the API", "Structured plan", "planning", "en",
                new Program.Metadata("some-remote-engine", false, false, false)));
        Assert.ThrowsException<InvalidOperationException>(
            () => Program.RequireProviderFreeEnhancement(response, "plan the API"));
    }
}
