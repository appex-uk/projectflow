/**
 * Notification Manager - Handles messages, alerts, and notifications
 */
class NotificationManager {
    constructor() {
        this.notifications = [];
        this.maxNotifications = 5;
        this.autoHideTimeout = 5000; // 5 seconds default
        
        this.initializeNotificationContainer();
        this.initializePerformanceMonitoring();
    }

    /**
     * Initialize notification container
     */
    initializeNotificationContainer() {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        this.container = container;
    }

    /**
     * Show a message notification
     */
    showMessage(message, type = 'info', duration = this.autoHideTimeout) {
        const toastType = type === 'error' ? 'error' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'info';
        if (window.WDS?.toast?.[toastType]) {
            if (this.notifications.length >= this.maxNotifications) {
                this.hideNotification(this.notifications[0].id);
            }

            const id = 'notification-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
            const toast = window.WDS.toast[toastType](message, {
                duration,
                position: 'top-right'
            });
            this.notifications.push({
                id,
                message,
                type: toastType,
                duration,
                timestamp: Date.now(),
                element: null,
                dismiss: () => toast.dismiss()
            });
            if (duration > 0) {
                setTimeout(() => {
                    this.notifications = this.notifications.filter(notification => notification.id !== id);
                }, duration + 250);
            }
            return id;
        }

        const notification = this.createNotification(message, type, duration);
        this.addNotification(notification);
        return notification.id;
    }

    /**
     * Show a success message
     */
    showSuccess(message, duration = 3000) {
        return this.showMessage(message, 'success', duration);
    }

    /**
     * Show an error message
     */
    showError(message, duration = 7000) {
        return this.showMessage(message, 'error', duration);
    }

    /**
     * Show a warning message
     */
    showWarning(message, duration = 4000) {
        return this.showMessage(message, 'warning', duration);
    }

    /**
     * Show an info message
     */
    showInfo(message, duration = 3000) {
        return this.showMessage(message, 'info', duration);
    }

    /**
     * Show a loading message
     */
    showLoading(message = 'Loading...', duration = 0) {
        if (window.WDS?.toast?.info) {
            return this.showMessage(message, 'info', duration);
        }

        const notification = this.createNotification(message, 'loading', duration);
        notification.element.classList.add('loading');
        this.addNotification(notification);
        return notification.id;
    }

    /**
     * Create a notification object
     */
    createNotification(message, type, duration) {
        const id = 'notification-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        const element = document.createElement('div');
        element.className = `notification notification-${type}`;
        element.setAttribute('data-id', id);
        element.setAttribute('role', 'alert');
        element.setAttribute('aria-live', 'polite');
        
        const icon = this.getTypeIcon(type);
        const closeButton = type !== 'loading' ? '<button class="notification-close" aria-label="Close notification">&times;</button>' : '';
        
        element.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${icon}</span>
                <span class="notification-message">${message}</span>
                ${closeButton}
            </div>
        `;

        // Add close button functionality
        const closeBtn = element.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideNotification(id));
        }

        const notification = {
            id,
            message,
            type,
            duration,
            element,
            timestamp: Date.now(),
            timeoutId: null
        };

        return notification;
    }

    /**
     * Get icon for notification type
     */
    getTypeIcon(type) {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            loading: '⏳'
        };
        return icons[type] || icons.info;
    }

    /**
     * Add notification to the container
     */
    addNotification(notification) {
        // Remove oldest notification if at max capacity
        if (this.notifications.length >= this.maxNotifications) {
            const oldest = this.notifications[0];
            this.hideNotification(oldest.id);
        }

        // Add to notifications array
        this.notifications.push(notification);

        // Add to DOM with animation
        this.container.appendChild(notification.element);
        
        // Trigger entrance animation
        setTimeout(() => {
            notification.element.classList.add('notification-show');
        }, 10);

        // Auto-hide after duration
        if (notification.duration > 0) {
            notification.timeoutId = setTimeout(() => {
                this.hideNotification(notification.id);
            }, notification.duration);
        }

        console.log(`Notification shown: ${notification.type} - ${notification.message}`);
    }

    /**
     * Hide a specific notification
     */
    hideNotification(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (!notification) return;

        if (notification.dismiss) {
            notification.dismiss();
            this.notifications = this.notifications.filter(n => n.id !== id);
            return;
        }

        // Clear timeout
        if (notification.timeoutId) {
            clearTimeout(notification.timeoutId);
        }

        // Animate out
        notification.element.classList.add('notification-hide');
        
        setTimeout(() => {
            // Remove from DOM
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            
            // Remove from array
            this.notifications = this.notifications.filter(n => n.id !== id);
        }, 300); // Animation duration
    }

    /**
     * Hide all notifications
     */
    hideAllNotifications() {
        [...this.notifications].forEach(notification => {
            this.hideNotification(notification.id);
        });
    }

    /**
     * Update a notification message
     */
    updateNotification(id, newMessage, newType = null) {
        const notification = this.notifications.find(n => n.id === id);
        if (!notification) return false;

        if (!notification.element) {
            this.hideNotification(id);
            this.showMessage(newMessage, newType || notification.type, notification.duration);
            return true;
        }

        const messageElement = notification.element.querySelector('.notification-message');
        if (messageElement) {
            messageElement.textContent = newMessage;
            notification.message = newMessage;
        }

        if (newType && newType !== notification.type) {
            notification.element.className = `notification notification-${newType} notification-show`;
            const iconElement = notification.element.querySelector('.notification-icon');
            if (iconElement) {
                iconElement.textContent = this.getTypeIcon(newType);
            }
            notification.type = newType;
        }

        return true;
    }

    /**
     * Show confirmation dialog
     */
    showConfirmation(message, options = {}) {
        return window.WDS.confirm({
            title: options.title || 'Confirm action',
            message,
            confirmLabel: options.confirmText || 'Confirm',
            cancelLabel: options.cancelText || 'Cancel',
            danger: options.type === 'danger'
        });
    }

    /**
     * Show input dialog
     */
    showInputDialog(message, options = {}) {
        return new Promise((resolve) => {
            const {
                title = 'Input Required',
                placeholder = '',
                defaultValue = '',
                confirmText = 'OK',
                cancelText = 'Cancel',
                inputType = 'text'
            } = options;

            const overlay = document.createElement('div');
            overlay.className = 'confirmation-overlay';
            
            const dialog = document.createElement('div');
            dialog.className = 'confirmation-dialog';
            
            dialog.innerHTML = `
                <div class="confirmation-header">
                    <h3>${title}</h3>
                </div>
                <div class="confirmation-body">
                    <p>${message}</p>
                    <input type="${inputType}" class="input-dialog-field" placeholder="${placeholder}" value="${defaultValue}">
                </div>
                <div class="confirmation-footer">
                    <button class="wds-btn wds-btn--secondary confirmation-cancel">${cancelText}</button>
                    <button class="wds-btn wds-btn--primary confirmation-confirm">${confirmText}</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            const input = dialog.querySelector('.input-dialog-field');
            const confirmBtn = dialog.querySelector('.confirmation-confirm');
            const cancelBtn = dialog.querySelector('.confirmation-cancel');
            
            // Focus the input
            setTimeout(() => {
                input.focus();
                input.select();
            }, 100);

            // Handle confirm
            const handleConfirm = () => {
                const value = input.value.trim();
                document.body.removeChild(overlay);
                resolve(value || null);
            };

            confirmBtn.addEventListener('click', handleConfirm);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                }
            });

            // Handle cancel
            const handleCancel = () => {
                document.body.removeChild(overlay);
                resolve(null);
            };

            cancelBtn.addEventListener('click', handleCancel);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) handleCancel();
            });

            // Handle escape key
            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', handleKeyDown);
                    handleCancel();
                }
            };
            document.addEventListener('keydown', handleKeyDown);
        });
    }

    /**
     * Initialize performance monitoring
     */
    initializePerformanceMonitoring() {
        // Monitor long-running operations
        this.performanceObserver = null;
        
        if ('PerformanceObserver' in window) {
            try {
                this.performanceObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        if (entry.duration > 1000) { // Operations taking more than 1 second
                            this.showWarning(`Slow operation detected: ${entry.name} took ${Math.round(entry.duration)}ms`);
                        }
                    });
                });
                
                this.performanceObserver.observe({ entryTypes: ['measure'] });
            } catch (error) {
                console.warn('Performance monitoring not available:', error);
            }
        }

        // Monitor memory usage (if available)
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                const used = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
                
                if (used > 0.9) { // 90% memory usage
                    this.showWarning('High memory usage detected. Consider refreshing the page.');
                }
            }, 30000); // Check every 30 seconds
        }
    }

    /**
     * Show task-related notifications
     */
    showTaskCreated(taskTitle) {
        this.showSuccess(`Task "${taskTitle}" created successfully! 🎉`);
    }

    showTaskUpdated(taskTitle) {
        this.showSuccess(`Task "${taskTitle}" updated successfully! ✏️`);
    }

    showTaskDeleted(taskTitle) {
        this.showInfo(`Task "${taskTitle}" deleted! 🗑️`);
    }

    showTaskStatusChanged(taskTitle, newStatus) {
        const statusEmojis = {
            todo: '📋',
            in_progress: '⚡',
            done: '✅',
            blocked: '🚫'
        };
        
        const emoji = statusEmojis[newStatus] || '📋';
        this.showSuccess(`Task "${taskTitle}" moved to ${newStatus.replace('_', ' ')} ${emoji}`);
    }

    /**
     * Show project-related notifications
     */
    showProjectChanged(projectName) {
        this.showInfo(`Switched to project: ${projectName} 📁`);
    }

    showProjectCreated(projectName) {
        this.showSuccess(`Project "${projectName}" created successfully! 🎯`);
    }

    /**
     * Show error notifications for different scenarios
     */
    showNetworkError() {
        this.showError('Network error. Please check your connection and try again. 🌐');
    }

    showSaveError() {
        this.showError('Failed to save changes. Please try again. 💾');
    }

    showLoadError() {
        this.showError('Failed to load data. Please refresh the page. 🔄');
    }

    /**
     * Get notification count
     */
    getNotificationCount() {
        return this.notifications.length;
    }

    /**
     * Get notifications by type
     */
    getNotificationsByType(type) {
        return this.notifications.filter(n => n.type === type);
    }

    /**
     * Clear all notifications of a specific type
     */
    clearNotificationsByType(type) {
        const notificationsToRemove = this.notifications.filter(n => n.type === type);
        notificationsToRemove.forEach(notification => {
            this.hideNotification(notification.id);
        });
    }

    /**
     * Set auto-hide timeout for new notifications
     */
    setAutoHideTimeout(timeout) {
        this.autoHideTimeout = timeout;
    }

    /**
     * Set max number of notifications
     */
    setMaxNotifications(max) {
        this.maxNotifications = max;
    }
}

// Export using ES6 module syntax
export { NotificationManager };
