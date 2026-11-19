# MCP Client Setup Guide

ProjectFlow serves its UI, REST API, and MCP endpoint from one process.

## Start ProjectFlow

Build once:

```bash
go build -o projectflow ./cmd/server
```

Then run the executable from any directory:

```bash
./projectflow
```

The local endpoints are:

- Web UI: `http://127.0.0.1:16191`
- MCP: `http://127.0.0.1:16191/mcp`

Project data is stored in an OS-specific user configuration directory unless `DATA_DIR` is set.

## Recommended: Streamable HTTP

Configure clients that accept an HTTP MCP server URL with:

```json
{
  "servers": {
    "projectflow": {
      "type": "http",
      "url": "http://127.0.0.1:16191/mcp"
    }
  }
}
```

For VS Code Copilot, put this configuration in `.vscode/mcp.json`. Some clients use an `mcpServers` property instead of `servers`; keep the same server name, type, and URL.

There is no second MCP process to start and no working directory requirement.

## Legacy: Stdio

Clients that only support stdio can continue to use the compatibility command:

```json
{
  "mcpServers": {
    "projectflow": {
      "command": "/absolute/path/to/projectflow-mcp",
      "args": [],
      "env": {
        "DATA_DIR": "/absolute/path/to/projectflow-data"
      }
    }
  }
}
```

Build that command separately:

```bash
go build -o projectflow-mcp ./cmd/mcp-server
```

The HTTP and stdio transports expose the same tools and resources.

## Verify the Connection

You can check that the HTTP endpoint responds before configuring a client:

```bash
curl -X POST http://127.0.0.1:16191/mcp \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

The response should contain 11 ProjectFlow tools.

## Available Capabilities

### Tools

- `list_tasks`
- `create_task`
- `get_task`
- `update_task`
- `delete_task`
- `get_task_hierarchy`
- `list_projects`
- `create_project`
- `get_project`
- `update_project`
- `delete_project`

### Resources

- `projectflow://tasks`
- `projectflow://hierarchy`
- `projectflow://summary`

## Troubleshooting

1. Confirm ProjectFlow is running: `curl http://127.0.0.1:16191/ready`.
2. Confirm the MCP URL includes `/mcp`.
3. Check that the client supports streamable HTTP; otherwise use the stdio compatibility command.
4. If using a custom data path, make sure `DATA_DIR` is writable.
5. Use `HOST=0.0.0.0` only when you intentionally want to expose ProjectFlow beyond the local computer.
