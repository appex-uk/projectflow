package models

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsValidHierarchyRelationship(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		parentType TaskType
		childType  TaskType
		valid      bool
	}{
		{
			name:       "epics contain stories",
			parentType: TypeEpic,
			childType:  TypeStory,
			valid:      true,
		},
		{
			name:       "stories contain tasks",
			parentType: TypeStory,
			childType:  TypeTask,
			valid:      true,
		},
		{
			name:       "epics cannot contain tasks directly",
			parentType: TypeEpic,
			childType:  TypeTask,
		},
		{
			name:       "epics cannot contain epics",
			parentType: TypeEpic,
			childType:  TypeEpic,
		},
		{
			name:       "stories cannot contain stories",
			parentType: TypeStory,
			childType:  TypeStory,
		},
		{
			name:       "tasks cannot contain children",
			parentType: TypeTask,
			childType:  TypeTask,
		},
		{
			name:       "legacy subtasks cannot form a hierarchy",
			parentType: TypeTask,
			childType:  TypeSubtask,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			assert.Equal(t, tt.valid, IsValidHierarchyRelationship(tt.parentType, tt.childType))
		})
	}
}
