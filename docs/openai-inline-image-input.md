# Secure Inline Image Input

The gateway supports bounded image input on `POST /v1/chat/completions` and
`POST /v1/responses`. The official OpenAI JavaScript SDK example exercises
both routes against the credential-free local fake provider.

## Security Contract

- Images must be inline `data:` URLs. Remote `http:` and `https:` image URLs
  fail closed, so image input does not create a second SSRF fetch path.
- Accepted media types are `image/png`, `image/jpeg`, `image/webp`, and
  `image/gif`. SVG and other active or ambiguous formats are rejected.
- Base64 must be canonical and unbroken. Malformed payloads are rejected before
  provider selection.
- A request may contain at most 8 images, at most 10 MiB per image, and at most
  20 MiB across all images.
- Image blocks are allowed only in user messages.
- Raw base64 is not written to logs, cache keys, guardrail scans, or fake
  responses. Cache and fake-provider evidence use a SHA-256 content fingerprint.
- Every image request requires the `vision` model capability. Primary and
  fallback candidates are filtered by this requirement; no matching model
  produces `NO_CAPABLE_PROVIDER_ROUTE` rather than silently dropping images.
- The token cost guard adds a conservative image budget of at least 1,024 input
  tokens per image and scales upward with encoded byte size.

## Chat Completions

```js
const completion = await client.chat.completions.create({
  model: "local-fake-model",
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "Describe this image" },
      {
        type: "image_url",
        image_url: {
          url: "data:image/png;base64,iVBORw0KGgo...",
          detail: "low",
        },
      },
    ],
  }],
});
```

## Responses

```js
const response = await client.responses.create({
  model: "local-fake-model",
  input: [{
    role: "user",
    content: [
      { type: "input_text", text: "Describe this image" },
      {
        type: "input_image",
        image_url: "data:image/png;base64,iVBORw0KGgo...",
        detail: "low",
      },
    ],
  }],
  store: false,
});
```

## Provider Mapping

OpenAI-compatible HTTP providers receive canonical `text` and `image_url`
blocks. The native Anthropic adapter converts validated inline images to
Anthropic `image` blocks with a base64 source. A model must advertise `vision`
before either adapter can be selected.

The fake provider does not claim image understanding. It proves protocol
normalization, capability routing, privacy-safe fingerprint propagation, SDK
compatibility, and process cleanup without a provider key or paid call.

## Verification

```bash
pnpm verify:public-clone
```

This verifier runs the official locked OpenAI SDK against both multimodal
routes, requires fake execution, rejects any failed check, and shuts down the
managed gateway. It proves the repository's wire and safety contract; it does
not prove the visual accuracy of any real model.
