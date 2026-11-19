package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDocsHandlerServesEmbeddedFiles(t *testing.T) {
	t.Parallel()

	documents := fstest.MapFS{
		"user-guide.md": {
			Data: []byte("# ProjectFlow User Guide\n\nPlan a project with ProjectFlow."),
		},
		"development/feature.md": {
			Data: []byte("# Feature Notes\n\nImplementation notes."),
		},
	}
	handler := NewDocsHandler(documents)

	t.Run("lists documents in the shape expected by the UI", func(t *testing.T) {
		t.Parallel()

		req := httptest.NewRequest(http.MethodGet, "/api/docs/list", nil)
		w := httptest.NewRecorder()

		handler.HandleDocsList(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		var response struct {
			Docs []DocumentInfo `json:"docs"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &response))
		require.Len(t, response.Docs, 2)
		assert.NotEmpty(t, response.Docs[0].Filename)
	})

	t.Run("reads a nested document", func(t *testing.T) {
		t.Parallel()

		req := httptest.NewRequest(http.MethodGet, "/api/docs/development/feature.md", nil)
		w := httptest.NewRecorder()

		handler.HandleDocsGet(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		var response DocumentContent
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &response))
		assert.Equal(t, "development/feature.md", response.Filename)
		assert.Contains(t, response.Content, "Implementation notes")
	})

	t.Run("reads a document without an extension", func(t *testing.T) {
		t.Parallel()

		req := httptest.NewRequest(http.MethodGet, "/api/docs/user-guide", nil)
		w := httptest.NewRecorder()

		handler.HandleDocsGet(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		var response DocumentContent
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &response))
		assert.Equal(t, "user-guide.md", response.Filename)
	})
}
