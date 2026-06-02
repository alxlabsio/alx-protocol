# Provider Integration

`alxMiddleware` wraps any client that exposes `messages.create` and `messages.stream`. Default extractors match the Anthropic SDK response shape. Override `extractText`, `extractModel`, and `streamCompleteEvent` for other providers.

## Anthropic

```ts
import Anthropic from "@anthropic-ai/sdk";
import { alxMiddleware } from "@alx-protocol/sdk/middleware";

const client = alxMiddleware(new Anthropic(), { outDir: ".alx/blocks" });
```

Default extractors handle Anthropic SDK format: reads `content[].text` and `response.model`.

## OpenAI

```ts
import OpenAI from "openai";
import { alxMiddleware } from "@alx-protocol/sdk/middleware";

const client = alxMiddleware(new OpenAI(), {
  outDir: ".alx/blocks",
  extractText: (r) => (r as any).choices?.[0]?.message?.content ?? "",
  extractModel: (_, r) => (r as any).model,
});
```

## Google Gemini

```ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { alxMiddleware } from "@alx-protocol/sdk/middleware";

const client = alxMiddleware(geminiClient, {
  outDir: ".alx/blocks",
  extractText: (r) => (r as any).candidates?.[0]?.content?.parts?.[0]?.text ?? "",
  extractModel: (p, _) => (p as any).model,
});
```

## Custom or self-hosted providers

Any client satisfying the `MessagesClient` interface works:

```ts
interface MessagesClient {
  messages: {
    create(params: MessageCreateParams): Promise<unknown>;
    stream?(params: MessageCreateParams): MessageStream;
  };
}
```

Supply `extractText` and `extractModel` to map the provider's response shape to Block content fields. Supply `streamCompleteEvent` if the provider's stream emits a different event name than `"message"`.

```ts
const client = alxMiddleware(myCustomClient, {
  outDir: ".alx/blocks",
  extractText: (r) => (r as any).output?.text ?? "",
  extractModel: (p, r) => (r as any).modelId ?? (p as any).model,
  streamCompleteEvent: "complete",  // provider-specific stream event
});
```

## Related Documents

- [API Reference](./api-reference.md) — full `AlxMiddlewareOptions` field table
- [Middleware source](../../sdk/src/middleware.ts) — implementation
