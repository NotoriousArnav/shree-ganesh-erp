# Health, OpenAPI and MCP

## Health check

`GET /health`

```json
{ "status": "ok" }
```

No authentication. Use it as a liveness probe.

## Database health

`GET /health/db`

```json
{ "status": "ok", "database": "connected" }
```

Runs `select 1`. On failure:

```json
{ "status": "error", "database": "unreachable" }
```

Status `503`. No authentication.

## Storage health

`GET /health/storage`

```json
{ "status": "ok", "storage": "connected" }
```

Checks that object storage is configured and the bucket is reachable. On
failure:

```json
{ "status": "error", "storage": "unreachable" }
```

Status `503`. No authentication.

## OpenAPI document

`GET /openapi.json`

Returns the OpenAPI 3.0 document. No authentication.

## Swagger UI

`GET /docs`

Serves interactive documentation generated from the same spec. No
authentication. The UI can call endpoints with a session cookie if you sign in
first in the same browser.

## MCP endpoint

`POST /mcp`

Accepts a Model Context Protocol Streamable HTTP request. The server identifies
itself as `mushak` version `0.0.0` and currently exposes one tool:

| Tool | Arguments | Result |
| --- | --- | --- |
| `health_check` | None | Text content `ok` |

Example JSON-RPC body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": { "name": "health_check", "arguments": {} }
}
```

```bash
curl -s -X POST http://localhost:8080/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"health_check","arguments":{}}}'
```

The MCP bridge is minimal and experimental. It does not require a session and
does not expose shop data. Treat the REST API as the supported integration
surface.

## Monitoring suggestions

| Probe | Interval | Alert on |
| --- | --- | --- |
| `/health` | 30 s | Two consecutive failures |
| `/health/db` | 60 s | Any 503 |
| `/health/storage` | 5 min | Any 503, or when images matter |
| `/openapi.json` | On deploy | Non-200 |

The health endpoints do not check the mailer. Mail failures surface in the
backend log when a reset is requested.
