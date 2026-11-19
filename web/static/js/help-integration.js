/**
 * Context-Sensitive Help Integration
 * Provides consistent help functionality throughout ProjectFlow
 */

export class HelpIntegration {
    constructor(docsManager) {
        this.docsManager = docsManager;
        this.isInitialized = false;
        this.helpElementsAdded = new Set();
        this.init();
    }

    init() {
        if (this.isInitialized) {
            console.log('HelpIntegration already initialized, skipping...');
            return;
        }
        
        this.addHelpStyles();
        this.setupGlobalHelp();
        this.isInitialized = true;
        console.log('HelpIntegration initialized');
    }

    /**
     * Add CSS for contextual help content
     */
    addHelpStyles() {
        if (document.getElementById('projectflow-help-styles')) return;

        const style = document.createElement('style');
        style.id = 'projectflow-help-styles';
        style.textContent = `
            /* Help Link Styles */
            .help-link {
                color: var(--wds-text-link);
                text-decoration: none;
                font-size: var(--wds-text-sm);
                display: inline-flex;
                align-items: center;
                gap: var(--wds-space-2xs);
                transition: color var(--wds-duration-fast) var(--wds-ease);
            }

            .help-link:hover {
                color: var(--wds-primary-hover);
                text-decoration: underline;
            }

            .help-link .icon {
                font-size: var(--wds-text-xs);
            }

            /* Help Section Styles */
            .help-section {
                margin-top: var(--wds-space-md);
                padding: var(--wds-space-md);
                background: var(--wds-surface-sunken);
                border-radius: var(--wds-radius-md);
                border-left: var(--wds-border-accent-width) solid var(--wds-primary);
            }

            .help-section h4 {
                margin: 0 0 var(--wds-space-xs) 0;
                color: var(--wds-text);
                font-size: var(--wds-text-sm);
                font-weight: var(--wds-font-weight-semibold);
            }

            .help-section p {
                margin: 0 0 var(--wds-space-xs) 0;
                font-size: var(--wds-text-sm);
                color: var(--wds-text-muted);
                line-height: var(--wds-line-height-normal);
            }

            .help-section .help-links {
                display: flex;
                gap: var(--wds-space-md);
                margin-top: var(--wds-space-sm);
            }

            /* Error Help Styles */
            .error-help {
                margin-top: var(--wds-space-sm);
                padding-top: var(--wds-space-sm);
                border-top: var(--wds-border-width) solid var(--wds-border);
            }

            .error-help .help-text {
                color: var(--wds-text-muted);
                font-size: var(--wds-text-sm);
                margin-bottom: var(--wds-space-xs);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Setup global help functionality
     */
    setupGlobalHelp() {
        // Make help functions available globally
        window.ProjectFlowHelp = {
            openDoc: (docName) => this.openDoc(docName),
            addHelpIcon: (element, docName, tooltip, placement) =>
                this.addHelpIcon(element, docName, tooltip, placement),
            addHelpLink: (element, docName, text) => this.addHelpLink(element, docName, text),
            addHelpSection: (container, title, description, links) => this.addHelpSection(container, title, description, links)
        };
    }

    /**
     * Open a specific documentation section
     */
    openDoc(docName) {
        if (this.docsManager) {
            this.docsManager.openDocument(docName);
        } else {
            console.warn('DocsManager not available');
        }
    }

    /**
     * Add a help icon next to an element
     */
    addHelpIcon(element, docName, tooltip = null, placement = null) {
        if (!element) return;

        const existingIcon = element.querySelector('.help-icon');
        if (existingIcon) return existingIcon;

        const existingGroup = element.parentElement?.classList.contains('help-target')
            ? element.parentElement
            : null;
        const groupedIcon = existingGroup?.querySelector('.help-icon');
        if (groupedIcon) return groupedIcon;

        const isInteractive = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']
            .includes(element.tagName);
        let host = element;

        if (isInteractive && element.parentElement) {
            if (existingGroup) {
                host = existingGroup;
            } else {
                host = document.createElement('span');
                host.className = 'help-target';
                element.parentElement.insertBefore(host, element);
                host.appendChild(element);
            }
        } else if (element.matches('.wds-field')) {
            host = element.querySelector('label') || element;
        }

        const label = tooltip || `Get help about ${docName}`;
        const helpIcon = document.createElement('button');
        helpIcon.className = 'help-icon wds-btn wds-btn--ghost wds-btn--icon wds-btn--sm';
        helpIcon.innerHTML = '<wds-icon name="info" size="14"></wds-icon>';
        helpIcon.setAttribute('type', 'button');
        helpIcon.setAttribute('aria-label', label);
        helpIcon.setAttribute(
            'data-wds-tooltip-placement',
            placement || (isInteractive ? 'bottom' : 'top')
        );
        helpIcon.setAttribute('data-wds-tooltip', label);
        helpIcon.setAttribute('data-doc', docName);

        helpIcon.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openDoc(docName);
        });

        host.appendChild(helpIcon);
        return helpIcon;
    }

    /**
     * Add a help link
     */
    addHelpLink(container, docName, text = '📚 Get Help') {
        if (!container) return;

        const helpLink = document.createElement('a');
        helpLink.href = '#';
        helpLink.className = 'help-link';
        helpLink.innerHTML = `<span class="icon">📚</span> ${text}`;
        
        helpLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.openDoc(docName);
        });

        container.appendChild(helpLink);
        return helpLink;
    }

    /**
     * Add a help section with links
     */
    addHelpSection(container, title, description, links = []) {
        if (!container) return;

        const helpSection = document.createElement('div');
        helpSection.className = 'help-section';

        const titleElement = document.createElement('h4');
        titleElement.textContent = title;
        helpSection.appendChild(titleElement);

        if (description) {
            const descElement = document.createElement('p');
            descElement.textContent = description;
            helpSection.appendChild(descElement);
        }

        if (links.length > 0) {
            const linksContainer = document.createElement('div');
            linksContainer.className = 'help-links';

            links.forEach(link => {
                const linkElement = document.createElement('a');
                linkElement.href = '#';
                linkElement.className = 'help-link';
                linkElement.textContent = link.text;
                
                linkElement.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openDoc(link.docName);
                });

                linksContainer.appendChild(linkElement);
            });

            helpSection.appendChild(linksContainer);
        }

        container.appendChild(helpSection);
        return helpSection;
    }

    /**
     * Add help to error messages
     */
    addErrorHelp(errorContainer, helpText, docName) {
        if (!errorContainer) return;

        const errorHelp = document.createElement('div');
        errorHelp.className = 'error-help';

        const helpTextElement = document.createElement('div');
        helpTextElement.className = 'help-text';
        helpTextElement.textContent = helpText;
        errorHelp.appendChild(helpTextElement);

        const helpLink = document.createElement('a');
        helpLink.href = '#';
        helpLink.className = 'help-link';
        helpLink.innerHTML = '📚 Get Help';
        
        helpLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.openDoc(docName);
        });

        errorHelp.appendChild(helpLink);
        errorContainer.appendChild(errorHelp);
        return errorHelp;
    }

    /**
     * Clear all help elements to prevent duplicates
     */
    clearHelpElements() {
        const existingIcons = document.querySelectorAll('.help-icon');
        const helpGroups = new Set();
        existingIcons.forEach(icon => {
            if (icon.parentElement?.classList.contains('help-target')) {
                helpGroups.add(icon.parentElement);
            }
            icon.remove();
        });

        helpGroups.forEach(group => {
            if (group.children.length === 1 && group.parentNode) {
                group.parentNode.insertBefore(group.children[0], group);
            }
            group.remove();
        });

        const helpSections = document.querySelectorAll('.chat-help-hints, .modal-help-section, .filter-help-section');
        helpSections.forEach(section => section.remove());

        this.helpElementsAdded.clear();

        console.log('Cleared existing help elements');
    }

    /**
     * Add contextual help based on the current view
     */
    addContextualHelp() {
        if (this.helpElementsAdded.has('contextual')) {
            console.log('Contextual help already added, skipping...');
            return;
        }
        
        console.log('Adding contextual help...');
        
        // Chat interface help
        this.addChatHelp();
        
        // Task creation help
        this.addTaskCreationHelp();
        
        // Project management help
        this.addProjectManagementHelp();
        
        // Kanban board help
        this.addKanbanHelp();
        
        // Filter help
        this.addFilterHelp();
        
        this.helpElementsAdded.add('contextual');
    }

    /**
     * Add help to chat interface
     */
    addChatHelp() {
        if (this.helpElementsAdded.has('chat')) return;
        
        const chatHeader = document.querySelector('.chat-header h3');
        if (chatHeader) {
            this.addHelpIcon(chatHeader, 'chat-interface-guide', 'Chat help');
        }

        const chatInput = document.querySelector('.chat-input-container');
        if (chatInput && !chatInput.querySelector('.chat-help-hints')) {
            const helpSection = document.createElement('div');
            helpSection.className = 'chat-help-hints';
            helpSection.innerHTML = `
                <p style="font-size: var(--wds-text-xs); color: var(--wds-text-muted); margin: var(--wds-space-xs) 0 0;">
                    💡 Try: "Create a task" or "Show me all projects" 
                    <a href="#" class="help-link" style="margin-left: var(--wds-space-xs);">📚 Chat Guide</a>
                </p>
            `;
            
            const helpLink = helpSection.querySelector('.help-link');
            helpLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.openDoc('chat-interface-guide');
            });
            
            chatInput.appendChild(helpSection);
        }
        
        this.helpElementsAdded.add('chat');
    }

    /**
     * Add help to task creation
     */
    addTaskCreationHelp() {
        if (this.helpElementsAdded.has('task-creation')) return;
        
        const newTaskBtn = document.querySelector('#new-task-btn');
        if (newTaskBtn) {
            this.addHelpIcon(newTaskBtn, 'user-guide', 'Task creation help', 'left');
        }

        const taskForm = document.querySelector('#task-form');
        if (taskForm) {
            const typeField = taskForm.querySelector('[name="type"]');
            if (typeField && typeField.parentElement) {
                this.addHelpIcon(typeField.parentElement, 'user-guide', 'Task type help');
            }

            const priorityField = taskForm.querySelector('[name="priority"]');
            if (priorityField && priorityField.parentElement) {
                this.addHelpIcon(priorityField.parentElement, 'user-guide', 'Priority help');
            }
        }
        
        this.helpElementsAdded.add('task-creation');
    }

    /**
     * Add help to project management
     */
    addProjectManagementHelp() {
        if (this.helpElementsAdded.has('project-management')) return;
        
        const projectSelector = document.querySelector('#project-selector-btn');
        if (projectSelector) {
            this.addHelpIcon(projectSelector, 'user-guide', 'Project help', 'left');
        }

        const createProjectBtn = document.querySelector('#create-project-btn');
        if (createProjectBtn) {
            this.addHelpIcon(createProjectBtn, 'user-guide', 'New project help', 'top');
        }
        
        this.helpElementsAdded.add('project-management');
    }

    /**
     * Add help to Kanban board
     */
    addKanbanHelp() {
        if (this.helpElementsAdded.has('kanban')) return;
        
        const kanbanView = document.querySelector('#kanban-view');
        if (kanbanView) {
            const columns = kanbanView.querySelectorAll('.column h3');
            columns.forEach(column => {
                if (column.textContent.includes('To Do')) {
                    this.addHelpIcon(column, 'user-guide', 'To Do help');
                } else if (column.textContent.includes('In Progress')) {
                    this.addHelpIcon(column, 'user-guide', 'In Progress help');
                } else if (column.textContent.includes('Done')) {
                    this.addHelpIcon(column, 'user-guide', 'Done help');
                } else if (column.textContent.includes('Blocked')) {
                    this.addHelpIcon(column, 'user-guide', 'Blocked help');
                }
            });
        }
        
        this.helpElementsAdded.add('kanban');
    }

    /**
     * Add help to filters
     */
    addFilterHelp() {
        if (this.helpElementsAdded.has('filter')) return;
        
        const filterBtn = document.querySelector('#filter-toggle-btn');
        if (filterBtn) {
            this.addHelpIcon(filterBtn, 'user-guide', 'Filter help');
        }
        
        this.helpElementsAdded.add('filter');
    }
}

export default HelpIntegration;
