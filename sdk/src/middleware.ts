/**
 * ALX Protocol SDK middleware.
 *
 * Drop-in wrapper that auto-locks every prompt + response pair from any
 * AI provider client into linked Blocks, written to an output directory
 * or collected in-memory.
 *
 * Provider-agnostic: works with any client that exposes a
 * `messages.create(params)` / `messages.stream(params)` interface.
 * Supply `extractText` and `extractModel` for providers whose response
 * shape differs from the Anthropic SDK default.
 *
 * Intercepts:
 *   messages.create()  — awaits the full response, then locks synchronously
 *   messages.stream()  — locks on the stream-complete event (full accumulated message)
 *
 * @example — non-streaming (Anthropic SDK)
 * import Anthropic from "@anthropic-ai/sdk";
 * import { alxMiddleware } from "@alx-protocol/sdk/middleware";
 *
 * const client = alxMiddleware(new Anthropic(), { outDir: ".alx/blocks" });
 * const msg = await client.messages.create({ model: "...", ... });
 * console.log(msg._alx.responseBlock.blockHash);
 *
 * @example — non-streaming (OpenAI SDK)
 * import OpenAI from "openai";
 * import { alxMiddleware } from "@alx-protocol/sdk/middleware";
 *
 * const client = alxMiddleware(new OpenAI(), {
 *   outDir: ".alx/blocks",
 *   extractText: (r) => (r as any).choices?.[0]?.message?.content ?? "",
 *   extractModel: (_, r) => (r as any).model,
 * });
 * const msg = await client.messages.create({ model: "...", ... });
 * console.log(msg._alx.responseBlock.blockHash);
 *
 * @example — streaming
 * const stream = client.messages.stream({ model: "...", ... });
 * for await (const chunk of stream) { ... }
 * const pair = await stream._alx;   // resolves after stream completes
 */

import { mkdir, writeFile } from "node:fs/promises";
import { createBlock } from "./block.js";
import type { Block } from "./block.js";

// ── Public types ──────────────────────────────────────────────────────────────

export interface AlxMiddlewareOptions {
  /** Directory to write .block.json files. Omit to collect in-memory only. */
  outDir?: string;
  /** Called after each pair is locked. Useful for custom persistence or logging. */
  onLock?: (pair: LockedBind) => void | Promise<void>;
  /**
   * Called when a side effect (onLock, persist, onEvict) throws.
   * Defaults to console.error. Errors never propagate to the caller (MW-3).
   */
  onError?: (err: unknown, pair: LockedBind) => void;
  /**
   * Called immediately before an entry is removed from history due to maxHistory.
   * Useful for flushing evicted pairs to disk before they are lost.
   * Errors are forwarded to onError and do not propagate.
   */
  onEvict?: (pair: LockedBind) => void | Promise<void>;
  /** Extra fields merged into prompt content (e.g. { pipeline: "q4-analysis" }). */
  promptMeta?: Record<string, unknown>;
  /** Extra fields merged into response content. */
  responseMeta?: Record<string, unknown>;
  /**
   * Maximum number of pairs kept in history. Oldest are evicted first.
   * Defaults to 100. Set to 0 for unlimited (memory leak risk in long-running processes).
   * Node.js is single-threaded: the splice+push sequence is atomic across awaits.
   */
  maxHistory?: number;
  /**
   * Inject wall-clock time for deterministic tests (MW-4).
   * Defaults to () => new Date().toISOString().
   */
  now?: () => string;
  /**
   * Extract the response text from a provider response object.
   * Defaults to Anthropic SDK format: `content[].text` concatenated.
   * Override for other providers:
   *   OpenAI: (r) => r.choices?.[0]?.message?.content ?? ""
   */
  extractText?: (response: unknown) => string;
  /**
   * Extract the model identifier from the provider response.
   * Defaults to Anthropic SDK format: `response.model ?? params.model`.
   * Override for providers that return the model name differently.
   */
  extractModel?: (params: unknown, response: unknown) => string | undefined;
  /**
   * Event name emitted by the stream with the full accumulated response.
   * Defaults to "message" (Anthropic SDK). Override for other providers.
   */
  streamCompleteEvent?: string;
}

export interface LockedBind {
  promptBlock: Block;
  responseBlock: Block;
  /** Wall-clock time the response was fully received (ISO 8601). */
  at: string;
  /** "create" for messages.create, "stream" for messages.stream. */
  via: "create" | "stream";
}

// ── Provider-agnostic client interface ────────────────────────────────────────
//
// Structural types only — no provider SDK is imported.
// Any client whose `messages` property satisfies this shape is compatible.

type MessageCreateParams = {
  model: string;
  messages: Array<{ role: string; content: unknown }>;
  system?: string;
  max_tokens?: number;
  temperature?: number;
  [key: string]: unknown;
};

// Opaque response — field extraction is delegated to extractText / extractModel
// options so the middleware is not coupled to any provider's response shape.
type MessageResponse = Record<string, unknown>;

// Minimal structural type for provider streams.
// Requires an event emitter interface and async iteration.
// The complete-event name is configurable via streamCompleteEvent (default: "message").
type MessageStream = {
  on(event: string, handler: (msg: unknown) => void): MessageStream;
  [Symbol.asyncIterator](): AsyncIterator<unknown>;
  [key: string]: unknown;
};

type MessagesClient = {
  messages: {
    create(params: MessageCreateParams): Promise<MessageResponse>;
    stream?(params: MessageCreateParams): MessageStream;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

// ── Internal shared helpers ───────────────────────────────────────────────────

// Default text extractor: Anthropic SDK response shape (content[].text).
function defaultExtractText(response: unknown): string {
  const r = response as { content?: Array<{ type?: string; text?: string }> };
  return (r.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("");
}

// Default model extractor: Anthropic SDK response shape (response.model).
function defaultExtractModel(params: unknown, response: unknown): string | undefined {
  const r = response as { model?: string };
  const p = params as { model?: string };
  return r.model ?? p.model;
}

/**
 * Build prompt and response Block content objects from a create/stream params
 * and the final response. Used by both wrappedCreate and wrappedStream
 * so locking logic stays in one place.
 */
function buildPairFromResponse(
  params: MessageCreateParams,
  response: MessageResponse,
  at: string,
  via: "create" | "stream",
  opts: Pick<AlxMiddlewareOptions, "promptMeta" | "responseMeta" | "extractText" | "extractModel">,
): LockedBind {
  const extractText = opts.extractText ?? defaultExtractText;
  const extractModel = opts.extractModel ?? defaultExtractModel;

  const promptContent: Record<string, unknown> = {
    type: "ai.prompt",
    messages: params.messages,
    model: params.model,
    ...(params.system != null ? { systemPrompt: params.system } : {}),
    ...(params.max_tokens != null ? { maxTokens: params.max_tokens } : {}),
    ...(params.temperature != null ? { temperature: params.temperature } : {}),
    ...(opts.promptMeta ?? {}),
  };

  const responseContent: Record<string, unknown> = {
    type: "ai.response",
    text: extractText(response),
    model: extractModel(params, response),
    ...(opts.responseMeta ?? {}),
  };

  const promptBlock = createBlock(promptContent, []);
  const responseBlock = createBlock(responseContent, [promptBlock.blockHash]);
  return { promptBlock, responseBlock, at, via };
}

// ── Middleware ────────────────────────────────────────────────────────────────

/**
 * Wrap any AI provider client to auto-lock every messages.create and
 * messages.stream call into linked Blocks.
 *
 * Returns a Proxy that passes all properties through unchanged (MW-1),
 * except messages.create and messages.stream which are intercepted.
 *
 * Provider defaults match the Anthropic SDK. Pass extractText, extractModel,
 * and streamCompleteEvent to adapt to other providers.
 */
export function alxMiddleware<T extends MessagesClient>(
  client: T,
  opts: AlxMiddlewareOptions = {},
): T & { _alx: { history: LockedBind[] } } {
  const history: LockedBind[] = [];
  const maxHistory = opts.maxHistory ?? 100;
  const now = opts.now ?? (() => new Date().toISOString());
  const streamCompleteEvent = opts.streamCompleteEvent ?? "message";

  const defaultOnError = (err: unknown, _pair: LockedBind) => {
    console.error("[alx-middleware] side-effect error:", err instanceof Error ? err.message : err);
  };
  const onError = opts.onError ?? defaultOnError;

  // ── History management (MW-5) ──────────────────────────────────────────────
  // Node.js is single-threaded: the slice-length check and push are not
  // interleaved across awaits, so concurrent calls cannot exceed maxHistory.
  async function recordPair(pair: LockedBind): Promise<void> {
    if (maxHistory > 0 && history.length >= maxHistory) {
      const evicted = history.splice(0, history.length - maxHistory + 1);
      for (const e of evicted) {
        try { await opts.onEvict?.(e); } catch (err) { onError(err, e); }
      }
    }
    history.push(pair);
  }

  // ── Side-effect runner (MW-3) ──────────────────────────────────────────────
  async function runSideEffects(pair: LockedBind): Promise<void> {
    try { await opts.onLock?.(pair); } catch (err) { onError(err, pair); }
    if (opts.outDir) {
      try { await persistPair(pair, opts.outDir); } catch (err) { onError(err, pair); }
    }
  }

  // ── messages.create interceptor ────────────────────────────────────────────
  const wrappedCreate = async (params: MessageCreateParams) => {
    const response = await client.messages.create(params);
    const pair = buildPairFromResponse(params, response, now(), "create", opts);
    await recordPair(pair);
    await runSideEffects(pair);
    return Object.assign(response, { _alx: pair });
  };

  // ── messages.stream interceptor (MW-2) ────────────────────────────────────
  // Seals on the "message" event which fires once with the full accumulated
  // MessageResponse after message_stop. The stream is returned immediately
  // so the caller can iterate chunks normally. stream._alx is a Promise that
  // resolves to the LockedBind when locking completes, or rejects if the
  // stream errors before message_stop.
  const wrappedStream = (params: MessageCreateParams): MessageStream & { _alx: Promise<LockedBind> } => {
    const underlying = client.messages.stream!(params);

    let resolvePair!: (pair: LockedBind) => void;
    let rejectPair!: (err: unknown) => void;
    const alxPromise = new Promise<LockedBind>((res, rej) => {
      resolvePair = res;
      rejectPair = rej;
    });

    underlying.on(streamCompleteEvent, async (finalMessage: unknown) => {
      const pair = buildPairFromResponse(params, finalMessage as MessageResponse, now(), "stream", opts);
      await recordPair(pair);
      await runSideEffects(pair);
      resolvePair(pair);
    });

    underlying.on("error", (err: unknown) => {
      rejectPair(err);
    });

    return new Proxy(underlying, {
      get(target, prop) {
        if (prop === "_alx") return alxPromise;
        const val = target[prop as string];
        return typeof val === "function" ? val.bind(target) : val;
      },
    }) as MessageStream & { _alx: Promise<LockedBind> };
  };

  // ── messages Proxy (MW-1) ──────────────────────────────────────────────────
  const wrappedMessages = new Proxy(client.messages, {
    get(target, prop) {
      if (prop === "create") return wrappedCreate;
      if (prop === "stream" && typeof target.stream === "function") return wrappedStream;
      const val = target[prop as string];
      return typeof val === "function" ? val.bind(target) : val;
    },
  });

  const alxState = { history };

  return new Proxy(client, {
    get(target, prop) {
      if (prop === "messages") return wrappedMessages;
      if (prop === "_alx") return alxState;
      const val = target[prop as string];
      return typeof val === "function" ? val.bind(target) : val;
    },
  }) as T & { _alx: { history: LockedBind[] } };
}

// ── Provider-agnostic lock helper ─────────────────────────────────────────────

/**
 * Manually lock a prompt + response pair without wrapping a client.
 * Use for frameworks that don't fit the middleware wrapper.
 *
 * MW-4: pass `at` explicitly for deterministic output in tests.
 *
 * @example
 * const pair = lockBind(
 *   { content: "Analyze Q4 trends" },
 *   { text: responseText, model: "claude-sonnet-4-6" },
 *   { at: new Date().toISOString() }
 * );
 */
export function lockBind(
  prompt: { content?: unknown; model?: string; [key: string]: unknown },
  response: { text: string; model?: string; [key: string]: unknown },
  opts?: { meta?: Record<string, unknown>; at?: string },
): LockedBind {
  const at = opts?.at ?? new Date().toISOString();
  const meta = opts?.meta ?? {};
  const promptBlock = createBlock({ type: "ai.prompt", ...prompt, ...meta }, []);
  const responseBlock = createBlock(
    { type: "ai.response", ...response, ...meta },
    [promptBlock.blockHash],
  );
  return { promptBlock, responseBlock, at, via: "create" };
}

// ── File persistence ──────────────────────────────────────────────────────────

/**
 * Write prompt + response blocks to outDir.
 * Filenames use blockHash prefix (first 10 hex chars) to avoid timestamp
 * collisions across concurrent calls (MW-4).
 */
async function persistPair(pair: LockedBind, outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const id = pair.responseBlock.blockHash.slice(2, 12);
  await writeFile(`${outDir}/prompt-${id}.block.json`, JSON.stringify(pair.promptBlock, null, 2) + "\n");
  await writeFile(`${outDir}/response-${id}.block.json`, JSON.stringify(pair.responseBlock, null, 2) + "\n");
}
