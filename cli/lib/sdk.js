const sdk = await Promise.all([
  import("@alx-protocol/sdk/canonicalization"),
  import("@alx-protocol/sdk/block"),
  import("@alx-protocol/sdk/lineage"),
  import("@alx-protocol/sdk/trace"),
]).then(([canon, block, lineage, trace]) => ({
  ...canon,
  ...block,
  ...lineage,
  ...trace,
}));

export default sdk;
