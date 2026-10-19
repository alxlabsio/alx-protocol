import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Helper that first tries to import the workspace package specifier (normal monorepo / installed case),
// and if that fails (e.g., running before the SDK `dist/` is built in certain CI jobs),
// falls back to importing the built SDK files from the local `sdk/dist` directory.
async function importSdkSubpath(subpath) {
  try {
    return await import(`@alx-protocol/sdk/${subpath}`);
  } catch (err) {
    // Fallback to local built artifact in the monorepo
    const fallback = pathToFileURL(resolve(__dirname, "../../sdk/dist", `${subpath}.js`)).href;
    return await import(fallback);
  }
}

const sdk = await Promise.all([
  importSdkSubpath("canonicalization"),
  importSdkSubpath("block"),
  importSdkSubpath("lineage"),
  importSdkSubpath("trace"),
]).then(([canon, block, lineage, trace]) => ({
  ...canon,
  ...block,
  ...lineage,
  ...trace,
}));

export default sdk;
