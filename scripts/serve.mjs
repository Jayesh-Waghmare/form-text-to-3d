import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".glb": "model/gltf-binary",
};
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (pathname.startsWith("/api/")) {
        const proxy = http.request(
          {
            hostname: "127.0.0.1",
            port: 8000,
            path: req.url,
            method: req.method,
            headers: { ...req.headers, host: "127.0.0.1:8000" },
          },
          (upstream) => {
            res.writeHead(upstream.statusCode || 502, upstream.headers);
            upstream.pipe(res);
          },
        );
        proxy.on("error", () => {
          res
            .writeHead(502, { "Content-Type": "application/json" })
            .end(
              JSON.stringify({ detail: "The Shap-E backend is not running." }),
            );
        });
        req.pipe(proxy);
        return;
      }
      const file = resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!file.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      const body = await readFile(file);
      res
        .writeHead(200, {
          "Content-Type": types[extname(file)] || "application/octet-stream",
        })
        .end(body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  })
  .listen(5173, "127.0.0.1", () => console.log("Local: http://127.0.0.1:5173"));
