package projectflow

import (
	"embed"
	"io/fs"
)

//go:embed docs web/static web/templates wds
var embeddedFiles embed.FS

// TemplateFiles returns the embedded HTML templates.
func TemplateFiles() fs.FS {
	return mustSub(embeddedFiles, "web/templates")
}

// StaticFiles returns the embedded CSS, JavaScript, and other web assets.
func StaticFiles() fs.FS {
	return mustSub(embeddedFiles, "web/static")
}

// DocumentationFiles returns the embedded in-app documentation.
func DocumentationFiles() fs.FS {
	return mustSub(embeddedFiles, "docs")
}

// WDSFiles returns the embedded Web Design System assets.
func WDSFiles() fs.FS {
	return mustSub(embeddedFiles, "wds")
}

func mustSub(root fs.FS, dir string) fs.FS {
	sub, err := fs.Sub(root, dir)
	if err != nil {
		panic(err)
	}
	return sub
}
