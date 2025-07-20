/**
 * Chat Goals Management
 * Handles all client-side operations for the chat goals tool.
 */
class GoalsManager {
    constructor() {
        this.bindEvents();
    }

    bindEvents() {
        // Click handler for the main goals toggle button
        $(document).off('click', '#goals-toggle').on('click', '#goals-toggle', () => {
            const $goalsOverlay = $('#goalsOverlay');
            if ($goalsOverlay.is(':visible')) {
                this.hide();
            } else {
                this.show();
            }
        });

        // Click handler for the close button
        $('#close-goalsOverlay').on('click', () => {
            this.hide();
        });

        // Click outside to close
        $(document).on('click', (e) => {
            if (!$(e.target).closest('#goalsOverlay, #goals-toggle').length) {
                this.hide();
            }
        });
    }

    // Show the goals overlay
    show() {
        $('#goalsOverlay').hide().slideDown('fast');
        this.loadGoals();
    }

    // Hide the goals overlay
    hide() {
        $('#goalsOverlay').slideUp('fast');
    }

    // Load goals for the current userChatId
    async loadGoals() {
        const userChatId = sessionStorage.getItem('userChatId') || window.userChatId;
        
        if (!userChatId) {
            this.displayError(window.translations?.goals?.no_chat || 'No active chat session');
            return;
        }

        try {
            $('#goals-content').html(`
                <div class="loading-spinner text-center mt-4">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">${window.translations?.loading || 'Loading'}</span>
                    </div>
                </div>
            `);

            const response = await fetch(`/api/chat-goals/${userChatId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.displayGoals(data);

        } catch (error) {
            console.error('Error loading goals:', error);
            this.displayError(window.translations?.goals?.load_error || 'Failed to load goals');
        }
    }

    // Display the goals data
    displayGoals(data) {
        const { currentGoal, completedGoals = [], goalStatus } = data;
        let html = '';

        // Current Goal Section
        if (currentGoal) {
            const statusColor = goalStatus?.completed ? 'success' : 
                               goalStatus?.confidence > 50 ? 'warning' : 'info';
            const statusIcon = goalStatus?.completed ? 'check-circle-fill' : 
                              goalStatus?.confidence > 50 ? 'clock-fill' : 'play-circle-fill';

            html += `
                <div class="current-goal-section mb-4">
                    <h5 class="text-primary mb-3">
                        <i class="bi bi-target me-2"></i>
                        ${window.translations?.goals?.current_goal || 'Current Goal'}
                    </h5>
                    <div class="goal-card current border-2 border-primary rounded-3 p-3 mb-3">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge bg-${this.getDifficultyColor(currentGoal.difficulty)} mb-2">${this.getDifficultyLabel(currentGoal.difficulty)}</span>
                            <span class="badge bg-${statusColor}">
                                <i class="bi bi-${statusIcon} me-1"></i>
                                ${goalStatus?.completed ? 
                                    (window.translations?.goals?.completed || 'Completed') : 
                                    (window.translations?.goals?.in_progress || 'In Progress')
                                }
                            </span>
                        </div>
                        <h6 class="goal-title mb-2">${currentGoal.goal_description}</h6>
                        <p class="goal-type text-muted mb-2">
                            <i class="bi bi-tag me-1"></i>
                            ${window.translations?.goals?.goal_type[currentGoal.goal_type] || currentGoal.goal_type}
                        </p>
                        <p class="goal-completion text-sm mb-2">
                            <i class="bi bi-check-square me-1"></i>
                            ${currentGoal.completion_condition}
                        </p>
                        <div class="goal-meta d-flex justify-content-between text-xs text-muted">
                            <span>
                                <i class="bi bi-chat-dots me-1"></i>
                                ~${currentGoal.estimated_messages} ${window.translations?.goals?.messages || 'messages'}
                            </span>
                            ${goalStatus?.confidence ? `
                                <span>
                                    <i class="bi bi-percent me-1"></i>
                                    ${goalStatus.confidence}% ${window.translations?.goals?.progress || 'progress'}
                                </span>
                            ` : ''}
                        </div>
                        ${goalStatus?.reason ? `
                            <div class="goal-status-reason mt-2 p-2 bg-light rounded">
                                <small class="text-muted">${goalStatus.reason}</small>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        // Completed Goals Section
        if (completedGoals.length > 0) {
            html += `
                <div class="completed-goals-section">
                    <h5 class="text-success mb-3">
                        <i class="bi bi-trophy-fill me-2"></i>
                        ${window.translations?.goals?.completed_goals || 'Completed Goals'} (${completedGoals.length})
                    </h5>
                    <div class="completed-goals-list">
            `;

            completedGoals.reverse().forEach((goal, index) => {
                const completedDate = goal.completedAt ? new Date(goal.completedAt).toLocaleDateString() : '';
                const rewardPoints = this.getRewardPoints(goal.difficulty);

                html += `
                    <div class="goal-card completed border rounded-3 p-3 mb-3 bg-light">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge bg-${this.getDifficultyColor(goal.difficulty)} mb-2">${this.getDifficultyLabel(goal.difficulty)}</span>
                            <div class="text-end">
                                <span class="badge bg-success">
                                    <i class="bi bi-check-circle-fill me-1"></i>
                                    ${window.translations?.goals?.completed || 'Completed'}
                                </span>
                                <div class="text-xs text-muted mt-1">${completedDate}</div>
                            </div>
                        </div>
                        <h6 class="goal-title mb-2">${goal.goal_description}</h6>
                        <p class="goal-type text-muted mb-2">
                            <i class="bi bi-tag me-1"></i>
                            ${window.translations?.goals?.goal_type[goal.goal_type] || goal.goal_type}
                        </p>
                        ${goal.reason ? `
                            <div class="completion-reason p-2 bg-success bg-opacity-10 rounded mb-2">
                                <small class="text-white">
                                    <i class="bi bi-lightbulb me-1"></i>
                                    ${goal.reason}
                                </small>
                            </div>
                        ` : ''}
                        <div class="goal-reward d-flex justify-content-between align-items-center">
                            <span class="text-warning">
                                <i class="bi bi-coin me-1"></i>
                                +${rewardPoints} ${window.translations?.goals?.points || 'points'}
                            </span>
                            <span class="text-muted text-xs">${index + 1}</span>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        // No goals message
        if (!currentGoal && completedGoals.length === 0) {
            html = `
                <div class="no-goals text-center py-4">
                    <i class="bi bi-trophy text-muted" style="font-size: 3rem;"></i>
                    <h6 class="text-muted mt-3">${window.translations?.goals?.no_goals || 'No goals yet'}</h6>
                    <p class="text-muted small">${window.translations?.goals?.start_chatting || 'Start chatting to generate conversation goals!'}</p>
                </div>
            `;
        }

        $('#goals-content').html(html);
    }

    // Display error message
    displayError(message) {
        $('#goals-content').html(`
            <div class="error-message text-center py-4">
                <i class="bi bi-exclamation-triangle text-warning" style="font-size: 3rem;"></i>
                <h6 class="text-muted mt-3">${message}</h6>
            </div>
        `);
    }

    // Get difficulty color class
    getDifficultyColor(difficulty) {
        switch (difficulty) {
            case 'easy': return 'success';
            case 'medium': return 'warning';
            case 'hard': return 'danger';
            default: return 'secondary';
        }
    }

    // Get difficulty label
    getDifficultyLabel(difficulty) {
        const labels = {
            easy: window.translations?.goals?.easy || 'Easy',
            medium: window.translations?.goals?.medium || 'Medium',
            hard: window.translations?.goals?.hard || 'Hard'
        };
        return labels[difficulty] || difficulty;
    }

    // Get reward points based on difficulty
    getRewardPoints(difficulty) {
        switch (difficulty) {
            case 'easy': return 100;
            case 'medium': return 200;
            case 'hard': return 300;
            default: return 100;
        }
    }
}

// Initialize goals manager when document is ready
$(document).ready(() => {
    window.goalsManager = new GoalsManager();
});
