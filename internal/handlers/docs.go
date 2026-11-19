package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"path"
	"regexp"
	"strings"
	"time"

	"github.com/appex-uk/projectflow/internal/logger"
)

// DocumentInfo represents metadata about a documentation file
type DocumentInfo struct {
	Name        string    `json:"name"`
	Filename    string    `json:"filename"`
	Path        string    `json:"path"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	ModifiedAt  time.Time `json:"modified_at"`
	Size        int64     `json:"size"`
}

// DocumentContent represents the full content of a documentation file
type DocumentContent struct {
	DocumentInfo
	Content string `json:"content"`
}

// DocsHandler handles documentation API endpoints
type DocsHandler struct {
	documents fs.FS
}

// NewDocsHandler creates a new documentation handler
func NewDocsHandler(documents fs.FS) *DocsHandler {
	return &DocsHandler{
		documents: documents,
	}
}

// HandleDocsList handles GET /api/docs/list
func (d *DocsHandler) HandleDocsList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	logger.Info("Listing embedded documentation files")

	docs, err := d.listDocuments()
	if err != nil {
		logger.Error("Failed to list documentation files", "error", err)
		http.Error(w, fmt.Sprintf("Failed to list documentation: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(struct {
		Docs []DocumentInfo `json:"docs"`
	}{Docs: docs}); err != nil {
		logger.Error("Failed to encode documentation list", "error", err)
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}

	logger.Info("Successfully listed documentation files", "count", len(docs))
}

// HandleDocsGet handles GET /api/docs/{filename}
func (d *DocsHandler) HandleDocsGet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract filename from path
	docPath := strings.TrimPrefix(r.URL.Path, "/api/docs/")
	if docPath == "" || docPath == "/" {
		http.Error(w, "Document name required", http.StatusBadRequest)
		return
	}

	// Clean and validate the path
	docPath = strings.TrimSuffix(docPath, "/")
	validationPath := docPath
	if !strings.HasSuffix(strings.ToLower(validationPath), ".md") {
		validationPath += ".md"
	}
	if !isValidDocPath(validationPath) {
		logger.Warn("Invalid document path requested", "path", docPath)
		http.Error(w, "Invalid document path", http.StatusBadRequest)
		return
	}

	logger.Info("Fetching documentation file", "path", docPath)

	// Get document content
	doc, err := d.getDocument(docPath)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			logger.Warn("Documentation file not found", "path", docPath)
			http.Error(w, "Document not found", http.StatusNotFound)
			return
		}
		logger.Error("Failed to read documentation file", "path", docPath, "error", err)
		http.Error(w, fmt.Sprintf("Failed to read document: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(doc); err != nil {
		logger.Error("Failed to encode documentation content", "path", docPath, "error", err)
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}

	logger.Info("Successfully served documentation file", "path", docPath, "size", len(doc.Content))
}

// listDocuments scans the docs directory and returns a list of available documents
func (d *DocsHandler) listDocuments() ([]DocumentInfo, error) {
	var docs []DocumentInfo

	err := fs.WalkDir(d.documents, ".", func(filePath string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Skip directories and non-markdown files
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			return nil
		}

		content, err := fs.ReadFile(d.documents, filePath)
		if err != nil {
			return err
		}

		info, err := entry.Info()
		if err != nil {
			return err
		}

		title, description, category := d.extractMetadata(filePath, content)

		name := strings.TrimSuffix(path.Base(filePath), ".md")
		if title == "" {
			title = formatTitle(name)
		}

		doc := DocumentInfo{
			Name:        name,
			Filename:    filePath,
			Path:        filePath,
			Title:       title,
			Description: description,
			Category:    category,
			ModifiedAt:  info.ModTime(),
			Size:        info.Size(),
		}

		docs = append(docs, doc)
		return nil
	})

	return docs, err
}

// getDocument reads and returns the content of a specific document
func (d *DocsHandler) getDocument(docPath string) (*DocumentContent, error) {
	if !strings.HasSuffix(strings.ToLower(docPath), ".md") {
		docPath += ".md"
	}

	if !isValidDocPath(docPath) {
		return nil, fs.ErrNotExist
	}

	content, err := fs.ReadFile(d.documents, docPath)
	if err != nil {
		return nil, err
	}

	info, err := fs.Stat(d.documents, docPath)
	if err != nil {
		return nil, err
	}

	title, description, category := d.extractMetadata(docPath, content)

	name := strings.TrimSuffix(path.Base(docPath), ".md")
	if title == "" {
		title = formatTitle(name)
	}

	doc := &DocumentContent{
		DocumentInfo: DocumentInfo{
			Name:        name,
			Filename:    docPath,
			Path:        docPath,
			Title:       title,
			Description: description,
			Category:    category,
			ModifiedAt:  info.ModTime(),
			Size:        info.Size(),
		},
		Content: string(content),
	}

	return doc, nil
}

// extractMetadata extracts title, description, and category from markdown frontmatter or content
func (d *DocsHandler) extractMetadata(filePath string, content []byte) (title, description, category string) {
	contentStr := string(content)

	// Try to extract title from markdown headers
	titleRegex := regexp.MustCompile(`^#\s+(.+)$`)
	if matches := titleRegex.FindStringSubmatch(contentStr); len(matches) > 1 {
		title = strings.TrimSpace(matches[1])
	}

	// Try to extract description from first paragraph
	lines := strings.Split(contentStr, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "#") && !strings.HasPrefix(line, "---") {
			// Take first non-header, non-empty line as description
			if len(line) > 100 {
				description = line[:97] + "..."
			} else {
				description = line
			}
			break
		}
	}

	// Determine category based on filename
	filename := strings.ToLower(path.Base(filePath))
	switch {
	case strings.Contains(filename, "user"):
		category = "User Guide"
	case strings.Contains(filename, "developer"):
		category = "Developer Guide"
	case strings.Contains(filename, "api") || strings.Contains(filename, "mcp"):
		category = "API Reference"
	case strings.Contains(filename, "config") || strings.Contains(filename, "deploy"):
		category = "Configuration"
	case strings.Contains(filename, "troubleshoot") || strings.Contains(filename, "faq"):
		category = "Support"
	default:
		category = "General"
	}

	return title, description, category
}

// isValidDocPath validates document path for API access
func isValidDocPath(docPath string) bool {
	return fs.ValidPath(docPath) && strings.HasSuffix(strings.ToLower(docPath), ".md")
}

// formatTitle converts a filename to a human-readable title
func formatTitle(name string) string {
	// Replace hyphens and underscores with spaces
	title := strings.ReplaceAll(name, "-", " ")
	title = strings.ReplaceAll(title, "_", " ")

	// Capitalize each word
	words := strings.Fields(title)
	for i, word := range words {
		if len(word) > 0 {
			words[i] = strings.ToUpper(word[:1]) + strings.ToLower(word[1:])
		}
	}

	return strings.Join(words, " ")
}
