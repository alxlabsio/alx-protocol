# Provider Client Adapters

The TypeScript SDK's optional `alxMiddleware` wraps a narrow client interface modeled on `messages.create()` and optional `messages.stream()`. It is an application convenience, not part of ALX core or portable conformance.

## Structural Requirement

The wrapped client must expose a compatible shape:

```ts
interface MessagesClient {
  messages: {
    create(params: MessageCreateParams): Promise<Record<string, unknown>>;
    stream?(params: MessageCreateParams): MessageStream;
  };
}
```

Provider SDKs with other entry points—such as response, chat-completion, or model-specific methods—need an application adapter. Passing such a client directly is not supported merely because custom text extraction is configured.

## Compatible Client Example

```ts
import { alxMiddleware } from "@alx-protocol/sdk/middleware";

const wrapped = alxMiddleware(compatibleClient, {
  outDir: ".alx/blocks",
  extractText: (response) => extractProviderText(response),
  extractModel: (params, response) => extractProviderModel(params, response),
  onError: (error) => applicationLogger.error(error),
});

const response = await wrapped.messages.create(request);
const { promptBlock, responseBlock } = response._alx;
```

The middleware records an application-defined prompt Block and a response Block that declares the prompt as a parent. That convention does not prove the provider executed the request faithfully or that the response is true.

## Adapter Checklist

- Map the provider's request to the middleware's `MessageCreateParams` shape without dropping material inputs.
- Extract complete response text and the actual model identifier.
- For streaming, emit one configured completion event containing the accumulated final response.
- Set explicit history limits and persist Blocks before eviction when durability matters.
- Treat middleware side-effect failures as application events; by design, they do not fail the provider request.
- Review content for secrets and regulated data before persisting it.
- Validate stored Blocks after retrieval and before making Graph claims.

Provider SDK APIs change independently of ALX. Keep concrete provider adapters and their compatibility tests in application repositories unless this repository directly maintains and tests them.

## Related Documents

- [`./agent-integration.md`](./agent-integration.md) — durable workflow boundaries
- [`./api-reference.md`](./api-reference.md) — exported middleware surface
- [`../../sdk/src/middleware.ts`](../../sdk/src/middleware.ts) — maintained structural contract
