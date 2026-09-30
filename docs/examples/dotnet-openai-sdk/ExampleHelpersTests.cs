// The example's own argument parser, lifted out of Program.cs's top-level statements so the demo and
// these tests share one implementation. The OpenAI SDK round-trip itself needs a gateway, so what is
// covered here is the part that decides WHICH gateway and how the URL is normalised -- the bug class
// that silently points the demo at the wrong endpoint.
//
// Before this file existed the project had no test framework at all: its `dotnet test` leg passed with
// zero tests, which dragged the quality matrix's evidence level down to execution_only (T-111).
using Microsoft.VisualStudio.TestTools.UnitTesting;

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

    // The OpenAI SDK appends `/v1` itself, so the example must hand it a base URL with no trailing
    // slash -- a doubled slash in the path is the failure this pins down.
    internal static string SdkEndpoint(string baseUrl) => $"{baseUrl}/v1";
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
            "https://gateway.example.test",
            ExampleHelpers.GetBaseUrl(new[] { "--base-url", "https://gateway.example.test/" }));
    }

    [TestMethod]
    public void BaseUrlIgnoresADanglingFlagWithoutAValue()
    {
        Assert.AreEqual("http://127.0.0.1:3100", ExampleHelpers.GetBaseUrl(new[] { "--base-url" }));
    }

    [TestMethod]
    public void TheSdkEndpointJoinsExactlyOneSlash()
    {
        Assert.AreEqual(
            "http://127.0.0.1:3100/v1",
            ExampleHelpers.SdkEndpoint(ExampleHelpers.GetBaseUrl(new[] { "--base-url", "http://127.0.0.1:3100/" })));
    }
}
