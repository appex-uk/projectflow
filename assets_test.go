package projectflow

import (
	"io/fs"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEmbeddedAssets(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		fs   fs.FS
		path string
	}{
		{
			name: "serves the application template",
			fs:   TemplateFiles(),
			path: "index.html",
		},
		{
			name: "serves a JavaScript asset",
			fs:   StaticFiles(),
			path: "js/app.js",
		},
		{
			name: "serves documentation",
			fs:   DocumentationFiles(),
			path: "user-guide.md",
		},
		{
			name: "serves the design system",
			fs:   WDSFiles(),
			path: "wds.css",
		},
		{
			name: "serves the design system modules",
			fs:   WDSFiles(),
			path: "components/modal/wds-modal.js",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			content, err := fs.ReadFile(tt.fs, tt.path)
			require.NoError(t, err)
			require.NotEmpty(t, content)
		})
	}
}
