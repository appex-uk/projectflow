package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/appex-uk/projectflow/internal/storage"
	protocol "github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
)

// NewProtocolServer builds the shared MCP server used by HTTP and stdio transports.
func NewProtocolServer(store storage.Storage) *mcpserver.MCPServer {
	service := NewMCPServer(store)
	protocolServer := mcpserver.NewMCPServer(
		"projectflow-mcp",
		"1.0.0",
		mcpserver.WithToolCapabilities(false),
		mcpserver.WithResourceCapabilities(false, false),
	)

	registerTools(protocolServer, service)
	registerResources(protocolServer, service)

	return protocolServer
}

// NewHTTPHandler serves MCP over streamable HTTP.
func NewHTTPHandler(store storage.Storage) http.Handler {
	return mcpserver.NewStreamableHTTPServer(
		NewProtocolServer(store),
		mcpserver.WithEndpointPath("/mcp"),
		mcpserver.WithStateLess(true),
	)
}

func registerTools(protocolServer *mcpserver.MCPServer, service *MCPServer) {
	response := service.handleToolsList(JSONRPCRequest{})
	tools, ok := response.Result.(ToolsListResult)
	if !ok {
		panic("ProjectFlow MCP tools returned an invalid list")
	}

	for _, tool := range tools.Tools {
		schema, err := json.Marshal(tool.InputSchema)
		if err != nil {
			panic(fmt.Sprintf("marshal MCP schema for %s: %v", tool.Name, err))
		}

		protocolServer.AddTool(
			protocol.NewToolWithRawSchema(tool.Name, tool.Description, schema),
			toolHandler(service),
		)
	}
}

func toolHandler(service *MCPServer) mcpserver.ToolHandlerFunc {
	return func(ctx context.Context, request protocol.CallToolRequest) (*protocol.CallToolResult, error) {
		response := service.handleToolsCall(JSONRPCRequest{
			JSONRPC: "2.0",
			Method:  "tools/call",
			Params: ToolCallRequest{
				Name:      request.Params.Name,
				Arguments: request.GetArguments(),
			},
		})
		if response.Error != nil {
			return protocol.NewToolResultError(response.Error.Message), nil
		}

		result, ok := response.Result.(ToolCallResult)
		if !ok {
			return protocol.NewToolResultError("MCP tool returned an invalid result"), nil
		}

		standardResult := &protocol.CallToolResult{
			IsError: result.IsError,
			Content: make([]protocol.Content, 0, len(result.Content)),
		}
		for _, content := range result.Content {
			standardResult.Content = append(standardResult.Content, protocol.TextContent{
				Type: protocol.ContentTypeText,
				Text: content.Text,
			})
		}
		return standardResult, nil
	}
}

func registerResources(protocolServer *mcpserver.MCPServer, service *MCPServer) {
	response := service.handleResourcesList(JSONRPCRequest{})
	resources, ok := response.Result.(ResourcesListResult)
	if !ok {
		panic("ProjectFlow MCP resources returned an invalid list")
	}

	for _, resource := range resources.Resources {
		mimeType := resource.MimeType
		protocolServer.AddResource(
			protocol.NewResource(
				resource.URI,
				resource.Name,
				protocol.WithResourceDescription(resource.Description),
				protocol.WithMIMEType(mimeType),
			),
			func(ctx context.Context, request protocol.ReadResourceRequest) ([]protocol.ResourceContents, error) {
				response := service.handleResourcesRead(JSONRPCRequest{
					JSONRPC: "2.0",
					Method:  "resources/read",
					Params: ResourceReadRequest{
						URI: request.Params.URI,
					},
				})
				if response.Error != nil {
					return nil, fmt.Errorf("%s", response.Error.Message)
				}

				result, ok := response.Result.(ResourceReadResult)
				if !ok {
					return nil, fmt.Errorf("MCP resource returned an invalid result")
				}

				contents := make([]protocol.ResourceContents, 0, len(result.Contents))
				for _, content := range result.Contents {
					contents = append(contents, protocol.TextResourceContents{
						URI:      request.Params.URI,
						MIMEType: mimeType,
						Text:     content.Text,
					})
				}
				return contents, nil
			},
		)
	}
}
