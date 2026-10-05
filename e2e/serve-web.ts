import { readFile, stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

/**
 * A static host for the door's export, the way Amplify serves it: `/privacy/` is `privacy/index.html`, and anything
 * missing is `404.html` with a 404. Listens on a free port and returns it, so a run never collides with another.
 */
export async function serveWeb(dir: string): Promise<{ server: Server; url: string }> {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    const target = normalize(join(dir, path));
    if (!target.startsWith(dir)) {
      res.writeHead(400).end();
      return;
    }
    for (const file of [target, join(target, "index.html")]) {
      const info = await stat(file).catch(() => null);
      if (info?.isFile()) {
        res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
        res.end(await readFile(file));
        return;
      }
    }
    res.writeHead(404, { "content-type": types[".html"] });
    res.end(await readFile(join(dir, "404.html")).catch(() => "not found"));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  return { server, url: `http://127.0.0.1:${address.port}` };
}
