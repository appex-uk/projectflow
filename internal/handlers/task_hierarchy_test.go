package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/appex-uk/projectflow/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandler_CreateTaskHierarchy(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		parentType models.TaskType
		childType  models.TaskType
		wantStatus int
	}{
		{
			name:       "creates a story below an epic",
			parentType: models.TypeEpic,
			childType:  models.TypeStory,
			wantStatus: http.StatusCreated,
		},
		{
			name:       "creates a task below a story",
			parentType: models.TypeStory,
			childType:  models.TypeTask,
			wantStatus: http.StatusCreated,
		},
		{
			name:       "rejects a task directly below an epic",
			parentType: models.TypeEpic,
			childType:  models.TypeTask,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "rejects a parent below an epic",
			parentType: models.TypeEpic,
			childType:  models.TypeEpic,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "rejects a story below a story",
			parentType: models.TypeStory,
			childType:  models.TypeStory,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "rejects a child below a task",
			parentType: models.TypeTask,
			childType:  models.TypeTask,
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			handler, taskStorage := setupHandler()
			parent := models.NewTask("Parent", "")
			parent.ID = "parent-1"
			parent.ProjectID = "PF"
			parent.Type = tt.parentType
			require.NoError(t, taskStorage.CreateTask(t.Context(), parent))

			body, err := json.Marshal(map[string]string{
				"title":      "Child",
				"type":       string(tt.childType),
				"parent_id":  parent.ID,
				"project_id": "PF",
			})
			require.NoError(t, err)

			req := httptest.NewRequest(http.MethodPost, "/api/tasks", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			recorder := httptest.NewRecorder()

			handler.HandleTasks(recorder, req)

			assert.Equal(t, tt.wantStatus, recorder.Code, recorder.Body.String())
		})
	}
}

func TestHandler_UpdateTaskHierarchy(t *testing.T) {
	t.Parallel()

	t.Run("moves a task below a story and updates both sides", func(t *testing.T) {
		t.Parallel()

		handler, taskStorage := setupHandler()
		parent := models.NewTask("Story", "")
		parent.ID = "story-1"
		parent.Type = models.TypeStory
		require.NoError(t, taskStorage.CreateTask(t.Context(), parent))

		child := models.NewTask("Task", "")
		child.ID = "task-1"
		child.Type = models.TypeTask
		require.NoError(t, taskStorage.CreateTask(t.Context(), child))

		body, err := json.Marshal(map[string]string{"parent_id": parent.ID})
		require.NoError(t, err)
		req := httptest.NewRequest(http.MethodPut, "/api/tasks/"+child.ID, bytes.NewReader(body))
		recorder := httptest.NewRecorder()

		handler.HandleTask(recorder, req)

		require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
		updatedParent, err := taskStorage.GetTask(t.Context(), parent.ID)
		require.NoError(t, err)
		updatedChild, err := taskStorage.GetTask(t.Context(), child.ID)
		require.NoError(t, err)
		assert.Equal(t, []string{child.ID}, updatedParent.Children)
		assert.Equal(t, parent.ID, updatedChild.ParentID)
	})

	t.Run("rejects a task directly below an epic", func(t *testing.T) {
		t.Parallel()

		handler, taskStorage := setupHandler()
		parent := models.NewTask("Epic", "")
		parent.ID = "epic-1"
		parent.Type = models.TypeEpic
		require.NoError(t, taskStorage.CreateTask(t.Context(), parent))

		child := models.NewTask("Task", "")
		child.ID = "task-1"
		child.Type = models.TypeTask
		require.NoError(t, taskStorage.CreateTask(t.Context(), child))

		body, err := json.Marshal(map[string]string{"parent_id": parent.ID})
		require.NoError(t, err)
		req := httptest.NewRequest(http.MethodPut, "/api/tasks/"+child.ID, bytes.NewReader(body))
		recorder := httptest.NewRecorder()

		handler.HandleTask(recorder, req)

		assert.Equal(t, http.StatusBadRequest, recorder.Code, recorder.Body.String())
	})

	t.Run("clears an existing parent from both sides", func(t *testing.T) {
		t.Parallel()

		handler, taskStorage := setupHandler()
		parent := models.NewTask("Story", "")
		parent.ID = "story-1"
		parent.Type = models.TypeStory
		require.NoError(t, taskStorage.CreateTask(t.Context(), parent))

		child := models.NewTask("Task", "")
		child.ID = "task-1"
		child.Type = models.TypeTask
		child.ParentID = parent.ID
		parent.AddChild(child.ID)
		require.NoError(t, taskStorage.CreateTask(t.Context(), child))
		require.NoError(t, taskStorage.UpdateTask(t.Context(), parent))

		body, err := json.Marshal(map[string]string{"parent_id": ""})
		require.NoError(t, err)
		req := httptest.NewRequest(http.MethodPut, "/api/tasks/"+child.ID, bytes.NewReader(body))
		recorder := httptest.NewRecorder()

		handler.HandleTask(recorder, req)

		require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
		updatedParent, err := taskStorage.GetTask(t.Context(), parent.ID)
		require.NoError(t, err)
		updatedChild, err := taskStorage.GetTask(t.Context(), child.ID)
		require.NoError(t, err)
		assert.Empty(t, updatedParent.Children)
		assert.Empty(t, updatedChild.ParentID)
	})
}

func TestHandler_AddTaskChildHierarchy(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		parentType models.TaskType
		childType  models.TaskType
		wantStatus int
	}{
		{
			name:       "adds a story below an epic",
			parentType: models.TypeEpic,
			childType:  models.TypeStory,
			wantStatus: http.StatusCreated,
		},
		{
			name:       "rejects a task below an epic",
			parentType: models.TypeEpic,
			childType:  models.TypeTask,
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			handler, taskStorage := setupHandler()
			parent := models.NewTask("Parent", "")
			parent.ID = "parent-1"
			parent.Type = tt.parentType
			require.NoError(t, taskStorage.CreateTask(t.Context(), parent))
			child := models.NewTask("Child", "")
			child.ID = "child-1"
			child.Type = tt.childType
			require.NoError(t, taskStorage.CreateTask(t.Context(), child))

			body, err := json.Marshal(map[string]string{"child_id": child.ID})
			require.NoError(t, err)
			req := httptest.NewRequest(
				http.MethodPost,
				"/api/tasks/"+parent.ID+"/children",
				bytes.NewReader(body),
			)
			recorder := httptest.NewRecorder()

			handler.HandleTaskChildren(recorder, req)

			assert.Equal(t, tt.wantStatus, recorder.Code, recorder.Body.String())
		})
	}
}

func TestHandler_MoveTaskHierarchy(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		parentType models.TaskType
		wantStatus int
	}{
		{
			name:       "moves a task below a story",
			parentType: models.TypeStory,
			wantStatus: http.StatusOK,
		},
		{
			name:       "rejects moving a task below an epic",
			parentType: models.TypeEpic,
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			handler, taskStorage := setupHandler()
			parent := models.NewTask("Parent", "")
			parent.ID = "parent-1"
			parent.Type = tt.parentType
			require.NoError(t, taskStorage.CreateTask(t.Context(), parent))
			child := models.NewTask("Child", "")
			child.ID = "child-1"
			child.Type = models.TypeTask
			require.NoError(t, taskStorage.CreateTask(t.Context(), child))

			body, err := json.Marshal(map[string]string{"new_parent_id": parent.ID})
			require.NoError(t, err)
			req := httptest.NewRequest(
				http.MethodPut,
				"/api/tasks/"+child.ID+"/move",
				bytes.NewReader(body),
			)
			recorder := httptest.NewRecorder()

			handler.HandleTaskMove(recorder, req)

			assert.Equal(t, tt.wantStatus, recorder.Code, recorder.Body.String())
		})
	}
}
