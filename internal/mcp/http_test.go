package mcp

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHTTPHandlerServesMCPRequests(t *testing.T) {
	t.Parallel()

	handler := NewHTTPHandler(newMockStorage())

	t.Run("initializes the server", func(t *testing.T) {
		t.Parallel()

		response := sendMCPRequest(t, handler, map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"method":  "initialize",
			"params": map[string]interface{}{
				"protocolVersion": "2025-03-26",
				"capabilities":    map[string]interface{}{},
				"clientInfo": map[string]interface{}{
					"name":    "projectflow-test",
					"version": "1.0.0",
				},
			},
		})

		require.Equal(t, http.StatusOK, response.Code)

		var body struct {
			Result struct {
				ProtocolVersion string `json:"protocolVersion"`
				ServerInfo      struct {
					Name string `json:"name"`
				} `json:"serverInfo"`
			} `json:"result"`
		}
		require.NoError(t, json.Unmarshal(response.Body.Bytes(), &body))
		assert.NotEmpty(t, body.Result.ProtocolVersion)
		assert.Equal(t, "projectflow-mcp", body.Result.ServerInfo.Name)
	})

	t.Run("lists existing tools", func(t *testing.T) {
		t.Parallel()

		response := sendMCPRequest(t, handler, map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      2,
			"method":  "tools/list",
		})

		require.Equal(t, http.StatusOK, response.Code)

		var body struct {
			Result struct {
				Tools []struct {
					Name string `json:"name"`
				} `json:"tools"`
			} `json:"result"`
		}
		require.NoError(t, json.Unmarshal(response.Body.Bytes(), &body))
		require.Len(t, body.Result.Tools, 11)

		toolNames := make([]string, 0, len(body.Result.Tools))
		for _, tool := range body.Result.Tools {
			toolNames = append(toolNames, tool.Name)
		}
		assert.ElementsMatch(t, []string{
			"list_tasks", "create_task", "get_task", "update_task", "delete_task",
			"get_task_hierarchy", "list_projects", "create_project", "get_project",
			"update_project", "delete_project",
		}, toolNames)
	})
}

func sendMCPRequest(t *testing.T, handler http.Handler, requestBody interface{}) *httptest.ResponseRecorder {
	t.Helper()

	body, err := json.Marshal(requestBody)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/mcp", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	return w
}
