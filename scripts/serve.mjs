// Minimal dependency-free static file server for local play and Playwright webServer.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const PORT = Number(process.env.PORT) || 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".vox": "application/octet-stream",
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let rel = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = normalize(join(ROOT, rel));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    let data;
    try {
      data = await readFile(filePath);
    } catch {
      // SPA fallback: client-side routes (e.g. /overworld, /stage/level-a) have no
      // extension and no backing file — serve index.html so the app can route them.
      if (extname(urlPath) === "") {
        data = await readFile(join(ROOT, "index.html"));
        res.writeHead(200, { "Content-Type": MIME[".html"] });
        res.end(data);
        return;
      }
      throw new Error("not found");
    }
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`TrainSetGo dev server: http://localhost:${PORT}`);
});
