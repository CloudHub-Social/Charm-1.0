# GIF Picker Setup

Charm's GIF picker expects two runtime pieces:

1. A Matrix media proxy that can translate `mxc://` URLs back to the upstream GIF CDN.
2. A real Klipy API key for search.

Without both values, Charm now keeps the GIF picker hidden.

## Recommended proxy: Soliditas on Cloudflare Workers

Upstream Sable uses [SableClient/soliditas](https://github.com/SableClient/soliditas), a small Cloudflare Worker that proxies Matrix media IDs to supported upstream GIF providers.

### 1. Create and deploy the Worker

```sh
git clone https://github.com/SableClient/soliditas.git
cd soliditas
pnpm install
```

Edit `wrangler.jsonc` and set the worker hostname variables:

```jsonc
{
  "name": "soliditas",
  "main": "src/index.ts",
  "vars": {
    "HOSTNAME": "gifs.example.org",
    "SERVERNAME": "gifs.example.org",
    "PORT": 443,
  },
}
```

Use the hostname you want Charm to emit in `mxc://` URLs. In most deployments, `HOSTNAME` and `SERVERNAME` should match.

Authenticate Wrangler, then deploy:

```sh
pnpm deploy
```

After deploy, either:

- attach your custom domain in the Cloudflare Workers dashboard, or
- use the generated `*.workers.dev` hostname directly.

### 2. Verify the proxy

Soliditas exposes a conversion helper:

```text
/_soliditas/adressconvert?remoteType=klipy&remoteId=<remote-path>
```

For Klipy, the remote ID is the CDN path after `https://static.klipy.com/ii/`.

Example:

- remote path: `ffd4ac143e6335ac68951b787d3c1902/e8/3a/5LM0jRpL.gif`
- resulting MXC host: `mxc://gifs.example.org/klipy_ZmZkNGFjMTQzZTYzMzVhYzY4OTUxYjc4N2QzYzE5MDIvZTgvM2EvNUxNMGpScEwuZ2lm`

If that MXC resolves through the Worker, the proxy is ready.

## Getting a Klipy API key

Klipy documents the GIF API at [docs.klipy.com](https://docs.klipy.com/). Their docs currently direct developers to retrieve API credentials from the Klipy docs/partner panel flow.

Practical flow:

1. Open [docs.klipy.com](https://docs.klipy.com/).
2. Sign in or create a Klipy developer/partner account.
3. Create or copy an API key for GIF search.
4. Keep the key private. Do not commit a production key into git.

## Charm configuration

Set both values in `config.json`:

```json
{
  "gifs": {
    "proxyUrl": "gifs.example.org",
    "klipyApiKey": "your-real-klipy-key"
  }
}
```

Notes:

- `proxyUrl` must match the hostname served by Soliditas.
- `klipyApiKey` must be a real key. The checked-in placeholder (`SET_YOUR_TOKEN_HERE`) is treated as disabled.
- If either value is missing, Charm hides the GIF picker instead of showing a broken search UI.
