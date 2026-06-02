# Examples

Runnable code examples demonstrating core ALX Protocol operations. Each example runs with a single command after `pnpm install` from the repo root.

## Prerequisites

```bash
pnpm install
pnpm build
```

---

## basic

Seals an artifact as a Block and verifies it locally. Demonstrates that tampered content produces a different `blockHash`.

```bash
node examples/basic/index.js
```

---

## agent-pair

Seals a prompt+response pair. The response Block declares the prompt as a parent — lineage is bound into `blockHash`, not inferred from logs. Demonstrates that substituting a different parent produces a different identity.

```bash
node examples/agent-pair/index.js
```

---

## derivation-graph

Builds a 4-block chain: `system-prompt → prompt → response → decision`. Runs `traceAttribution` to compute path counts and depth across the derivation graph.

```bash
node examples/derivation-graph/index.js
```
