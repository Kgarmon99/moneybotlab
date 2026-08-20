import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

const files = {
  "/": { source: "index.html", type: "text/html; charset=utf-8", encoding: "utf8" },
  "/index.html": { source: "index.html", type: "text/html; charset=utf-8", encoding: "utf8" },
  "/assets/lab-hero.png": { source: "assets/lab-hero.png", type: "image/png", encoding: "base64" },
  "/assets/moneybot-labs-hero.png": { source: "assets/moneybot-labs-hero.png", type: "image/png", encoding: "base64" }
};

await rm("dist", { recursive: true, force: true });
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });

const manifest = {};
for (const [route, meta] of Object.entries(files)) {
  const body = await readFile(meta.source, meta.encoding);
  manifest[route] = {
    type: meta.type,
    encoding: meta.encoding,
    body
  };
}

const server = `const files = ${JSON.stringify(manifest)};\n\nfunction responseFor(url) {\n  const path = new URL(url).pathname;\n  return files[path] || files[\"/\"];\n}\n\nexport default {\n  async fetch(request) {\n    const asset = responseFor(request.url);\n    const body = asset.encoding === \"base64\"\n      ? Uint8Array.from(atob(asset.body), (char) => char.charCodeAt(0))\n      : asset.body;\n\n    return new Response(body, {\n      headers: {\n        \"content-type\": asset.type,\n        \"cache-control\": \"no-store\"\n      }\n    });\n  }\n};\n`;

await writeFile("dist/server/index.js", server);
await writeFile("dist/.openai/hosting.json", await readFile(".openai/hosting.json", "utf8"));
