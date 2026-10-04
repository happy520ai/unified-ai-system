// The example's own argument parser and its "did the fake provider answer?" predicate, lifted
// verbatim out of Program.cs's top-level statements so both the runnable demo and these tests
// share ONE implementation. Before this file existed the project had no test framework at all:
// its `dotnet test` leg passed with zero tests, which dragged the whole quality matrix's
// evidence level down to execution_only (registered as T-111).
using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;

// Lives in the global namespace on purpose: Program.cs uses top-level statements, whose generated
// type is global too, so the shared helpers must be reachable from there without a using.
internal static class ExampleHelpers
{
    internal static string GetBaseUrl(string[] args)
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

    // The shape the gateway answers with when the local fake provider served the request. The
    // example refuses to claim success without it, so a regression here is a real false "ok".
    internal static bool HasFakeExecution(JsonDocument document)
    {
        return document.RootElement.TryGetProperty("unified_ai", out var unified)
            && unified.TryGetProperty("execution_mode", out var mode)
            && mode.GetString() == "fake";
    }

    // The channel predicate the example reports as `checks.chat`: the fake provider echoes the
    // request content back, and a content that no longer echoes means the channel broke.
    internal static bool EchoedContent(JsonDocument document, string expected)
    {
        var content = document.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? "";
        return content.Contains(expected, StringComparison.Ordinal);
    }
}

[TestClass]
public sealed class ExampleHelpersTests
{
    [TestMethod]
    public void BaseUrlDefaultsToTheLocalLoopbackAddress()
    {
        Assert.AreEqual("http://127.0.0.1:3100", ExampleHelpers.GetBaseUrl(Array.Empty<string>()));
    }

    [TestMethod]
    public void BaseUrlAcceptsAnOverrideAndDropsATrailingSlash()
    {
        Assert.AreEqual(
            "http://127.0.0.1:9999",
            ExampleHelpers.GetBaseUrl(new[] { "--base-url", "http://127.0.0.1:9999/" }));
    }

    [TestMethod]
    public void BaseUrlIgnoresADanglingFlagWithoutAValue()
    {
        // A flag at the end has no value; the default must survive rather than throw.
        Assert.AreEqual("http://127.0.0.1:3100", ExampleHelpers.GetBaseUrl(new[] { "--base-url" }));
    }

    [TestMethod]
    public void FakeExecutionIsRecognisedOnlyWhenTheFieldReallySaysFake()
    {
        using var document = JsonDocument.Parse("{\"unified_ai\":{\"execution_mode\":\"fake\"}}");
        Assert.IsTrue(ExampleHelpers.HasFakeExecution(document));
    }

    [TestMethod]
    public void FakeExecutionIsRefusedWhenTheFieldIsMissingOrDifferent()
    {
        using var missing = JsonDocument.Parse("{\"unified_ai\":{}}");
        using var other = JsonDocument.Parse("{\"unified_ai\":{\"execution_mode\":\"real\"}}");
        using var absent = JsonDocument.Parse("{}");
        Assert.IsFalse(ExampleHelpers.HasFakeExecution(missing));
        Assert.IsFalse(ExampleHelpers.HasFakeExecution(other));
        Assert.IsFalse(ExampleHelpers.HasFakeExecution(absent));
    }

    [TestMethod]
    public void EchoedContentIsDetectedInTheOpenAIShapedAnswer()
    {
        using var document = JsonDocument.Parse(
            "{\"choices\":[{\"message\":{\"content\":\"[fake:local-fake-provider/local-fake-model] .NET HttpClient runtime test\"}}]}");
        Assert.IsTrue(ExampleHelpers.EchoedContent(document, ".NET HttpClient runtime test"));
    }

    [TestMethod]
    public void NonEchoedContentIsNotClaimedAsEchoed()
    {
        using var document = JsonDocument.Parse("{\"choices\":[{\"message\":{\"content\":\"something else\"}}]}");
        Assert.IsFalse(ExampleHelpers.EchoedContent(document, ".NET HttpClient runtime test"));
    }
}
