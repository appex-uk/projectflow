package handlers

import (
	"io"
	"log/slog"
	"testing"

	"github.com/appex-uk/projectflow/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChatHandler_CreateTaskHierarchy(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		parentType models.TaskType
		childType  models.TaskType
		wantErr    bool
	}{
		{
			name:       "creates a task below a story",
			parentType: models.TypeStory,
			childType:  models.TypeTask,
		},
		{
			name:       "rejects a task below an epic",
			parentType: models.TypeEpic,
			childType:  models.TypeTask,
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			taskStorage := newMockStorage()
			parent := models.NewTask("Parent", "")
			parent.ID = "parent-1"
			parent.DisplayID = "PF-1"
			parent.Type = tt.parentType
			require.NoError(t, taskStorage.CreateTask(t.Context(), parent))
			handler := &ChatHandler{
				storage: taskStorage,
				logger:  slog.New(slog.NewTextHandler(io.Discard, nil)),
			}

			_, err := handler.executeCreateTask(map[string]interface{}{
				"title":      "Child",
				"type":       string(tt.childType),
				"parent_id":  parent.DisplayID,
				"project_id": "PF",
			})

			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			assert.NoError(t, err)
		})
	}
}
