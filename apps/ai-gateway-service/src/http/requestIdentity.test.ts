import { describe, expect, it } from "vitest";
import { createRequestIdentityResolver, parseTrustedProxyCidrs } from "./requestIdentity.ts";

const SECRET = "0123456789abcdef0123456789abcdef";

function request(remoteAddress: string, forwardedFor?: string, authorization?: string) {
  return {
    socket: { remoteAddress },
    headers: {
      ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
      ...(authorization ? { authorization } : {}),
    },
  };
}

describe("request identity resolver", () => {
  it("ignores spoofed forwarding headers from an untrusted direct peer", () => {
    const resolver = createRequestIdentityResolver({ trustedProxyCidrs: ["10.0.0.0/8"] });
    const identity = resolver.resolve(request("203.0.113.10", "198.51.100.20"));

    expect(identity).toMatchObject({
      subject: "network:203.0.113.10",
      clientAddress: "203.0.113.10",
      forwarded: false,
      trustedProxyHops: 0,
    });
  });

  it("walks a trusted chain from right to left and stops at the first untrusted address", () => {
    const resolver = createRequestIdentityResolver({
      trustedProxyCidrs: ["10.0.0.0/8", "192.0.2.0/24"],
    });
    const identity = resolver.resolve(request("10.0.0.5", "198.51.100.7, 192.0.2.9"));

    expect(identity).toMatchObject({
      subject: "network:198.51.100.7",
      clientAddress: "198.51.100.7",
      forwarded: true,
      trustedProxyHops: 2,
    });
  });

  it("falls back to the direct peer for malformed or oversized chains", () => {
    const resolver = createRequestIdentityResolver({ trustedProxyCidrs: ["10.0.0.0/8"], maxForwardedHops: 2 });
    expect(resolver.resolve(request("10.0.0.5", "not-an-ip")).subject).toBe("network:10.0.0.5");
    expect(resolver.resolve(request("10.0.0.5", "198.51.100.1, 198.51.100.2, 198.51.100.3")).subject)
      .toBe("network:10.0.0.5");
  });

  it("normalizes IPv4-mapped peers before CIDR matching", () => {
    const resolver = createRequestIdentityResolver({ trustedProxyCidrs: ["127.0.0.0/8"] });
    expect(resolver.resolve(request("::ffff:127.0.0.1", "198.51.100.8"))).toMatchObject({
      subject: "network:198.51.100.8",
      forwarded: true,
    });
  });

  it("uses a fixed HMAC subject for credentials without exposing the secret", () => {
    const resolver = createRequestIdentityResolver({
      subjectMode: "credential-or-network",
      secret: SECRET,
    });
    const first = resolver.resolve(request("203.0.113.1", undefined, "Bearer tenant-token"));
    const second = resolver.resolve(request("203.0.113.2", undefined, "Bearer tenant-token"));

    expect(first.subjectKind).toBe("credential");
    expect(first.subject).toBe(second.subject);
    expect(first.subject).toMatch(/^credential:[a-f0-9]{64}$/);
    expect(first.subject).not.toContain("tenant-token");
  });

  it("rejects unsafe identity configuration at startup", () => {
    expect(() => createRequestIdentityResolver({
      subjectMode: "credential-or-network",
      secret: "short",
    })).toThrow(/at least 32 bytes/);
    expect(() => createRequestIdentityResolver({ trustedProxyCidrs: ["not-a-cidr"] })).toThrow(/Invalid trusted proxy CIDR/);
    expect(parseTrustedProxyCidrs("10.0.0.0/8, 192.0.2.0/24")).toEqual(["10.0.0.0/8", "192.0.2.0/24"]);
  });
});
