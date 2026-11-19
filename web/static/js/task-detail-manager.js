/**
 * Task Detail Manager - Handles task detail modal functionality
 */
import { formatDate, formatDateTime, escapeHtml } from './utils.js';
import {
    getAllowedParentType,
    getEligibleParentTasks,
    TASK_CREATION_TYPES
} from './task-hierarchy.js';

export class TaskDetailManager {
    constructor(apiClient, stateManager, taskManager = null) {
        this.apiClient = apiClient;
        this.stateManager = stateManager;
        this.taskManager = taskManager;
        this.modal = null;
        this.currentTask = null;
        this.availableTasks = [];
        this.loadingParentTasks = false;
        this.parentTasksFailedToLoad = false;
        
        this.init();
    }

    /**
     * Initialize the task detail manager
     */
    init() {
        this.modal = document.getElementById('task-detail-modal');
        if (!this.modal) {
            console.error('Task detail modal not found');
            return;
        }

        this.setupEventListeners();
        this.setupKanbanCardClickHandlers();
        this.setupTaskActionHandlers();
        this.setupTaskFormHandlers();
        this.stateManager.addEventListener('show-task-detail', ({ task }) => {
            if (task?.id) {
                this.showTaskDetails(task.id);
            }
        });
    }

    /**
     * Setup event listeners for the modal
     */
    setupEventListeners() {
        // Close modal events
        const closeBtn = this.modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideModal());
        }

        // Close modal when clicking outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hideModal();
            }
        });

        // Handle edit and delete buttons
        const editBtn = document.getElementById('detail-edit-btn');
        const deleteBtn = document.getElementById('detail-delete-btn');
        const resourcePanel = document.getElementById('task-detail-panel');

        if (editBtn) {
            editBtn.addEventListener('click', () => this.handleEdit());
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.handleDelete());
        }

        if (resourcePanel) {
            resourcePanel.addEventListener('wds-edit', () => this.handleEdit());
            resourcePanel.addEventListener('wds-delete', () => this.handleDelete(true));
        }

        // Listen for ESC key to close modal
        document.addEventListener('keydown', (e) => {
            const isOpen = typeof this.modal.open_ === 'boolean'
                ? this.modal.open_
                : this.modal.style.display !== 'none';
            if (e.key === 'Escape' && isOpen) {
                this.hideModal();
            }
        });
    }

    /**
     * Setup click handlers for kanban cards
     */
    setupKanbanCardClickHandlers() {
        // Add click handlers to existing cards
        this.attachCardClickHandlers();

        // Listen for DOM changes to handle dynamically added cards
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.classList && node.classList.contains('task-card')) {
                                this.attachClickHandler(node);
                            } else {
                                const cards = node.querySelectorAll('.task-card');
                                cards.forEach(card => this.attachClickHandler(card));
                            }
                        }
                    });
                }
            });
        });

        // Observe the kanban board for changes
        const kanbanView = document.getElementById('kanban-view');
        if (kanbanView) {
            observer.observe(kanbanView, {
                childList: true,
                subtree: true
            });
        }
    }

    /**
     * Attach click handlers to all existing kanban cards
     */
    attachCardClickHandlers() {
        const cards = document.querySelectorAll('.task-card');
        cards.forEach(card => this.attachClickHandler(card));
    }

    /**
     * Attach click handler to a single card
     */
    attachClickHandler(card) {
        // Avoid duplicate handlers
        if (card.dataset.clickHandlerAttached) {
            return;
        }

        card.addEventListener('click', (e) => {
            // Don't show modal if clicking on action buttons
            if (e.target.classList.contains('edit-task') || 
                e.target.classList.contains('delete-task') ||
                e.target.closest('.task-actions')) {
                return;
            }

            const taskId = card.dataset.id;
            if (taskId) {
                this.showTaskDetails(taskId);
            }
        });

        card.dataset.clickHandlerAttached = 'true';
    }

    /**
     * Show task details in modal
     */
    async showTaskDetails(taskId) {
        try {
            // Show loading state
            this.showLoadingState();
            
            // Fetch task details
            const task = await this.apiClient.getTask(taskId);
            if (!task) {
                throw new Error('Task not found');
            }

            this.currentTask = task;
            this.populateModal(task);
            this.showModal();

        } catch (error) {
            console.error('Error loading task details:', error);
            this.hideModal();
            
            // Show error message if notification manager is available
            if (window.projectFlowApp?.notificationManager?.showMessage) {
                window.projectFlowApp.notificationManager.showMessage(
                    'Failed to load task details: ' + error.message, 
                    'error'
                );
            }
        }
    }

    /**
     * Show loading state in modal
     */
    showLoadingState() {
        this.modal.querySelector('#detail-modal-title').textContent = 'Loading...';
        this.modal.querySelector('#detail-task-title').textContent = 'Loading task details...';
        this.modal.querySelector('#detail-task-description').textContent = '';
        this.showModal();
    }

    /**
     * Populate modal with task data
     */
    populateModal(task) {
        // Modal title
        const modalTitle = this.modal.querySelector('#detail-modal-title');
        modalTitle.textContent = `${task.display_id || task.id}`;

        const resourcePanel = document.getElementById('task-detail-panel');
        if (resourcePanel) {
            resourcePanel.querySelector('.wds-resource-panel-title')?.replaceChildren(
                document.createTextNode(task.display_id || task.id)
            );
            resourcePanel.querySelector('.wds-resource-panel-subheading')?.replaceChildren(
                document.createTextNode(`${this.formatType(task.type)} · Project task`)
            );
            const statusBadge = resourcePanel.querySelector('.wds-resource-panel-title-row .wds-badge');
            if (statusBadge) {
                statusBadge.textContent = this.formatStatus(task.status);
                statusBadge.className = `wds-badge wds-badge--${this.getStatusVariant(task.status)}`;
            }
        }

        // Task title and description
        const titleEl = this.modal.querySelector('#detail-task-title');
        const descriptionEl = this.modal.querySelector('#detail-task-description');
        
        titleEl.textContent = task.title || 'No title';
        descriptionEl.textContent = task.description || 'No description provided';

        // Task metadata
        this.populateTaskMetadata(task);

        // Show/hide conditional sections
        this.updateConditionalSections(task);
    }

    /**
     * Populate task metadata fields
     */
    populateTaskMetadata(task) {
        // Type
        const typeEl = this.modal.querySelector('#detail-task-type');
        if (typeEl) {
            typeEl.textContent = task.type || 'task';
            typeEl.className = `wds-badge wds-badge--info task-type task-type-${task.type || 'task'}`;
        }

        // Status
        const statusEl = this.modal.querySelector('#detail-task-status');
        if (statusEl) {
            statusEl.textContent = this.formatStatus(task.status);
            statusEl.className = `wds-badge wds-badge--${this.getStatusVariant(task.status)} task-status status-${task.status || 'todo'}`;
        }

        // Priority
        const priorityEl = this.modal.querySelector('#detail-task-priority');
        if (priorityEl) {
            priorityEl.textContent = task.priority || 'medium';
            const priorityVariant = {
                low: 'success',
                medium: 'warning',
                high: 'danger',
                critical: 'danger'
            }[task.priority] || 'neutral';
            priorityEl.className = `wds-badge wds-badge--${priorityVariant} task-priority priority-${task.priority || 'medium'}`;
        }

        // Created date
        const createdAtEl = this.modal.querySelector('#detail-task-created-at');
        if (createdAtEl) {
            createdAtEl.textContent = formatDate(task.created_at);
        }

        // Due date
        const dueDateEl = this.modal.querySelector('#detail-task-due-date');
        if (dueDateEl) {
            dueDateEl.textContent = task.due_date ? formatDate(task.due_date) : '';
        }

        // Started at
        const startedAtEl = this.modal.querySelector('#detail-task-started-at');
        if (startedAtEl) {
            startedAtEl.textContent = task.started_at ? formatDateTime(task.started_at) : '';
        }

        // Children count
        const childrenEl = this.modal.querySelector('#detail-task-children');
        if (childrenEl) {
            const childCount = task.children ? task.children.length : 0;
            childrenEl.textContent = childCount > 0
                ? `${childCount} child${childCount > 1 ? 'ren' : ''}`
                : '';
        }
    }

    /**
     * Update visibility of conditional sections
     */
    updateConditionalSections(task) {
        // Due date row
        const dueDateRow = this.modal.querySelector('#detail-due-date-row');
        if (dueDateRow) {
            dueDateRow.style.display = task.due_date ? 'flex' : 'none';
        }

        // Started at row
        const startedAtRow = this.modal.querySelector('#detail-started-at-row');
        if (startedAtRow) {
            startedAtRow.style.display = task.started_at ? 'flex' : 'none';
        }

        // Children row
        const childrenRow = this.modal.querySelector('#detail-children-row');
        if (childrenRow) {
            const hasChildren = task.children && task.children.length > 0;
            childrenRow.style.display = hasChildren ? 'flex' : 'none';
        }
    }

    /**
     * Format status for display
     */
    formatStatus(status) {
        const statusMap = {
            'todo': 'To Do',
            'in_progress': 'In Progress',
            'done': 'Done',
            'blocked': 'Blocked'
        };
        return statusMap[status] || status;
    }

    formatType(type) {
        const value = type || 'task';
        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    getStatusVariant(status) {
        return {
            todo: 'neutral',
            in_progress: 'info',
            done: 'success',
            blocked: 'danger'
        }[status] || 'neutral';
    }

    /**
     * Show the modal
     */
    showModal() {
        if (this.modal) {
            if (typeof this.modal.open === 'function') {
                this.modal.open();
            } else {
                this.modal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            }
        }
    }

    /**
     * Hide the modal
     */
    hideModal() {
        if (this.modal) {
            if (typeof this.modal.close === 'function') {
                this.modal.close();
            } else {
                this.modal.style.display = 'none';
                document.body.style.overflow = '';
            }
            this.currentTask = null;
        }
    }

    /**
     * Handle edit button click
     */
    handleEdit() {
        if (this.currentTask) {
            const taskId = this.currentTask.id;
            this.hideModal();
            this.openEditModal(taskId);
        }
    }

    /**
     * Handle delete button click
     */
    async handleDelete(confirmed = false) {
        if (this.currentTask) {
            const taskId = this.currentTask.id;
            this.hideModal();
            await this.handleDeleteTask(taskId, confirmed);
        }
    }

    /**
     * Setup event delegation for task action buttons (edit/delete)
     */
    setupTaskActionHandlers() {
        // Use event delegation to handle dynamically added buttons
        document.addEventListener('click', (e) => {
            // Handle edit button clicks
            if (e.target.classList.contains('edit-task')) {
                e.preventDefault();
                e.stopPropagation();
                const taskId = e.target.dataset.id;
                if (taskId) {
                    this.openEditModal(taskId);
                }
            }
            
            // Handle delete button clicks
            if (e.target.classList.contains('delete-task')) {
                e.preventDefault();
                e.stopPropagation();
                const taskId = e.target.dataset.id;
                if (taskId) {
                    this.handleDeleteTask(taskId);
                }
            }
        });
    }

    /**
     * Setup the shared create/edit task form.
     */
    setupTaskFormHandlers() {
        const newTaskButton = document.getElementById('new-task-btn');
        const newTaskMenu = document.getElementById('new-task-menu');
        const taskModal = document.getElementById('task-modal');
        const form = document.getElementById('task-form');

        newTaskMenu?.addEventListener('wds-select', (event) =>
            this.openNewTaskModal(event.detail?.value)
        );
        if (!newTaskMenu) {
            newTaskButton?.addEventListener('click', () => this.openNewTaskModal('task'));
        }
        form?.addEventListener('submit', (event) => this.submitTaskForm(event));
        form?.querySelector('#task-type')?.addEventListener('change', (event) => {
            this.updateParentOptions(event.target.value);
        });

        const cancelButton = document.getElementById('cancel-btn');
        cancelButton?.addEventListener('click', () => this.hideEditModal());

        const closeButton = taskModal?.querySelector('.close');
        closeButton?.addEventListener('click', () => this.hideEditModal());

        taskModal?.addEventListener('click', (event) => {
            if (event.target === taskModal) {
                this.hideEditModal();
            }
        });
    }

    /**
     * Open a blank task form for the selected project.
     */
    async openNewTaskModal(taskType = 'task') {
        const project = this.stateManager.getCurrentProject();
        if (!project) {
            window.projectFlowApp?.projectManager?.showCreateProjectDialog();
            window.projectFlowApp?.notificationManager?.showMessage(
                'Create or select a project before adding a task.',
                'info'
            );
            return;
        }

        const modal = document.getElementById('task-modal');
        const form = document.getElementById('task-form');
        const modalTitle = document.getElementById('modal-title');
        if (!modal || !form) return;

        form.reset();
        form.removeAttribute('data-task-id');
        delete form.dataset.taskId;
        const selectedType = TASK_CREATION_TYPES.includes(taskType) ? taskType : 'task';
        const typeLabel = selectedType[0].toUpperCase() + selectedType.slice(1);
        const typeSelect = form.querySelector('#task-type');
        if (typeSelect) typeSelect.value = selectedType;
        if (modalTitle) modalTitle.textContent = `New ${typeLabel}`;
        const saveButton = form.querySelector('#save-btn');
        if (saveButton) saveButton.textContent = `Create ${typeLabel}`;

        this.availableTasks = [];
        this.loadingParentTasks = true;
        this.updateParentOptions(selectedType);

        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        document.getElementById('task-title')?.focus();

        await this.loadParentTasks();
        const currentType = form.querySelector('#task-type')?.value || selectedType;
        const currentParent = form.querySelector('#task-parent-id')?.value || '';
        this.updateParentOptions(currentType, currentParent);
    }

    /**
     * Submit the shared form in create or edit mode.
     */
    async submitTaskForm(event) {
        event.preventDefault();

        const form = event.currentTarget || document.getElementById('task-form');
        if (!form) return;

        const taskId = form.dataset.taskId;
        const formData = new FormData(form);
        const taskData = this.taskManager?.processTaskFormData
            ? this.taskManager.processTaskFormData(formData)
            : this.processTaskFormData(formData);
        const saveButton = form.querySelector('#save-btn');
        if (saveButton) saveButton.disabled = true;

        try {
            if (taskId) {
                if (this.taskManager?.updateTask) {
                    await this.taskManager.updateTask(taskId, taskData);
                } else {
                    await this.apiClient.updateTask(taskId, taskData);
                }
            } else {
                const project = this.stateManager.getCurrentProject();
                if (!project) {
                    throw new Error('Create or select a project before adding a task');
                }

                if (this.taskManager?.createTask) {
                    await this.taskManager.createTask(taskData);
                } else {
                    await this.apiClient.createTask({
                        ...taskData,
                        project_id: project.display_prefix
                    });
                }
            }

            this.hideEditModal();
        } catch (error) {
            console.error('Error saving task:', error);
            window.projectFlowApp?.notificationManager?.showMessage(
                'Failed to save task: ' + error.message,
                'error'
            );
        } finally {
            if (saveButton) saveButton.disabled = false;
        }
    }

    processTaskFormData(formData) {
        return {
            title: formData.get('title'),
            description: formData.get('description'),
            type: formData.get('type'),
            priority: formData.get('priority'),
            status: formData.get('status'),
            due_date: formData.get('due_date') || null,
            started_at: formData.get('started_at')
                ? new Date(formData.get('started_at')).toISOString()
                : null,
            ...(formData.get('parent_id') !== null
                ? { parent_id: formData.get('parent_id') }
                : {})
        };
    }

    /**
     * Open edit modal for a task
     */
    async openEditModal(taskId) {
        try {
            const task = await this.apiClient.getTask(taskId);
            if (!task) {
                throw new Error('Task not found');
            }

            await this.loadParentTasks();
            this.populateEditModal(task);
            this.showEditModal();

        } catch (error) {
            console.error('Error loading task for editing:', error);
            if (window.projectFlowApp?.notificationManager?.showMessage) {
                window.projectFlowApp.notificationManager.showMessage(
                    'Failed to load task for editing: ' + error.message, 
                    'error'
                );
            }
        }
    }

    /**
     * Populate the edit modal with task data
     */
    populateEditModal(task) {
        const modal = document.getElementById('task-modal');
        if (!modal) return;

        // Set modal title
        const modalTitle = modal.querySelector('#modal-title');
        if (modalTitle) {
            modalTitle.textContent = `Edit Task - ${task.display_id || task.id}`;
        }

        // Populate form fields
        const form = modal.querySelector('#task-form');
        if (form) {
            form.reset();
            form.dataset.taskId = task.id; // Store task ID for update

            const titleInput = form.querySelector('#task-title');
            const descriptionInput = form.querySelector('#task-description');
            const typeSelect = form.querySelector('#task-type');
            const prioritySelect = form.querySelector('#task-priority');
            const statusSelect = form.querySelector('#task-status');
            const dueDateInput = form.querySelector('#task-due-date');
            const startedAtInput = form.querySelector('#task-started-at');

            if (titleInput) titleInput.value = task.title || '';
            if (descriptionInput) descriptionInput.value = task.description || '';
            if (typeSelect) typeSelect.value = task.type || 'task';
            if (prioritySelect) prioritySelect.value = task.priority || 'medium';
            if (statusSelect) statusSelect.value = task.status || 'todo';
            this.updateParentOptions(task.type || 'task', task.parent_id || '', task.id);
            
            if (dueDateInput && task.due_date) {
                // Convert date to YYYY-MM-DD format
                const dueDate = new Date(task.due_date);
                dueDateInput.value = dueDate.toISOString().split('T')[0];
            }

            if (startedAtInput && task.started_at) {
                // Convert to datetime-local format
                const startedAt = new Date(task.started_at);
                startedAtInput.value = startedAt.toISOString().slice(0, 16);
            }

            const saveButton = form.querySelector('#save-btn');
            if (saveButton) saveButton.textContent = 'Save changes';
        }

    }

    async loadParentTasks() {
        const project = this.stateManager.getCurrentProject();
        if (!project || !this.apiClient.loadTasks) {
            this.loadingParentTasks = false;
            this.availableTasks = [];
            return [];
        }

        this.loadingParentTasks = true;
        this.parentTasksFailedToLoad = false;
        try {
            this.availableTasks = await this.apiClient.loadTasks(project.display_prefix);
            return this.availableTasks;
        } catch (error) {
            console.error('Failed to load possible parent tasks:', error);
            window.projectFlowApp?.notificationManager?.showMessage(
                'The task form is open, but parent options could not be loaded.',
                'error'
            );
            this.availableTasks = [];
            this.parentTasksFailedToLoad = true;
            return [];
        } finally {
            this.loadingParentTasks = false;
        }
    }

    updateParentOptions(taskType, selectedParentId = '', excludedTaskId = '') {
        const parentGroup = document.getElementById('task-parent-group');
        const parentSelect = document.getElementById('task-parent-id');
        const parentHint = document.getElementById('task-parent-hint');
        if (!parentGroup || !parentSelect) return;

        const allowedParentType = getAllowedParentType(taskType);
        if (!allowedParentType) {
            parentGroup.hidden = true;
            parentGroup.style.display = 'none';
            parentSelect.disabled = taskType !== 'epic';
            parentSelect.value = taskType === 'epic' ? '' : selectedParentId;
            if (parentHint) {
                parentHint.textContent = taskType === 'epic'
                    ? 'Epics are top-level work items.'
                    : '';
            }
            return;
        }

        const candidates = getEligibleParentTasks(taskType, this.availableTasks, excludedTaskId);
        const selectedIsEligible = candidates.some(task => task.id === selectedParentId);
        const parentLabel = allowedParentType[0].toUpperCase() + allowedParentType.slice(1);

        parentGroup.hidden = false;
        parentGroup.style.display = '';
        parentSelect.disabled = this.loadingParentTasks || this.parentTasksFailedToLoad;
        parentSelect.innerHTML = `<option value="">No parent</option>`;

        if (this.loadingParentTasks) {
            parentSelect.innerHTML += '<option value="" disabled>Loading parent options...</option>';
        } else if (this.parentTasksFailedToLoad) {
            if (selectedParentId) {
                parentSelect.innerHTML += `<option value="${escapeHtml(selectedParentId)}">Current parent</option>`;
            } else {
                parentSelect.innerHTML += '<option value="" disabled>Parent options unavailable</option>';
            }
        } else if (candidates.length === 0) {
            parentSelect.innerHTML += `<option value="" disabled>No ${parentLabel.toLowerCase()}s available</option>`;
        } else {
            for (const task of candidates) {
                const identifier = task.display_id ? `${task.display_id} - ` : '';
                parentSelect.innerHTML += `<option value="${escapeHtml(task.id)}">${escapeHtml(identifier + task.title)}</option>`;
            }
        }

        parentSelect.value = selectedIsEligible || (
            this.parentTasksFailedToLoad && selectedParentId
        ) ? selectedParentId : '';
        if (parentHint) {
            parentHint.textContent = `${parentLabel}s are the only valid parent for a ${taskType}.`;
        }
    }

    /**
     * Show the edit modal
     */
    showEditModal() {
        const modal = document.getElementById('task-modal');
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Hide the edit modal
     */
    hideEditModal() {
        const modal = document.getElementById('task-modal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            
            // Clear form data
            const form = modal.querySelector('#task-form');
            if (form) {
                form.reset();
                form.removeAttribute('data-task-id');
            }
        }
    }

    /**
     * Handle delete task
     */
    async handleDeleteTask(taskId, alreadyConfirmed = false) {
        try {
            const task = await this.apiClient.getTask(taskId);
            if (!task) {
                throw new Error('Task not found');
            }

            const confirmDelete = alreadyConfirmed || await window.WDS.confirm({
                title: `Delete "${task.title}"?`,
                message: 'This task will be permanently removed.',
                confirmLabel: 'Delete task',
                danger: true
            });
            if (confirmDelete) {
                await this.apiClient.deleteTask(taskId);
                
                // Remove the task card from the DOM immediately for better UX
                const taskCard = document.querySelector(`[data-id="${taskId}"]`);
                if (taskCard) {
                    taskCard.remove();
                }
                
                if (window.projectFlowApp?.notificationManager?.showMessage) {
                    window.projectFlowApp.notificationManager.showMessage(
                        'Task deleted successfully!', 
                        'success'
                    );
                }
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            if (window.projectFlowApp?.notificationManager?.showMessage) {
                window.projectFlowApp.notificationManager.showMessage(
                    'Failed to delete task: ' + error.message, 
                    'error'
                );
            }
        }
    }

    /**
     * Refresh card click handlers (call this when cards are updated)
     */
    refreshCardHandlers() {
        // Clear existing handlers
        const cards = document.querySelectorAll('.task-card');
        cards.forEach(card => {
            card.removeAttribute('data-click-handler-attached');
        });
        
        // Re-attach handlers
        this.attachCardClickHandlers();
    }
}
