/**
 * Live Goals Widget
 * Displays real-time milestone progress in the chat interface
 */
class LiveGoalsWidget {
    constructor() {
        this.isExpanded = false; // Start collapsed
        this.currentGoals = {
            messages: { current: 0, next: 10, milestone: 10, reward: 25 },
            images: { current: 0, next: 5, milestone: 5, reward: 250 },
            videos: { current: 0, next: 3, milestone: 3, reward: 500 }
        };
        this.bindEvents();
        
        // Don't load initial data here, wait for chat to open
    }

    bindEvents() {
        // Toggle button click
        $(document).on('click', '#goals-toggle-btn', () => {
            this.toggleExpanded();
        });
        
        // Close button click
        $(document).on('click', '#goals-close-btn', () => {
            this.collapse();
        });
        
        // Click outside to close
        $(document).on('click', (e) => {
            if (this.isExpanded && !$(e.target).closest('#live-goals-widget').length) {
                this.collapse();
            }
        });

        // Listen for WebSocket milestone updates
        if (window.webSocketUserPointsHandler) {
            // Add our handler to the existing WebSocket system
            const originalHandler = window.webSocketUserPointsHandler.handlePointsMessage.bind(window.webSocketUserPointsHandler);
            window.webSocketUserPointsHandler.handlePointsMessage = (data) => {
                const handled = originalHandler(data);
                if (!handled) {
                    this.handleLiveGoalsUpdate(data);
                }
                return handled;
            };
        }

        // Listen for milestone achievement events
        $(document).on('milestoneAchieved', (e, data) => {
            this.handleMilestoneAchieved(data);
        });

        // Listen for points update events
        $(document).on('pointsUpdate', (e, data) => {
            this.refreshGoalData();
        });
    }

    async loadInitialData() {
        // Use userChatId like the existing goals system for consistency
        const userChatId = sessionStorage.getItem('userChatId') || window.userChatId;
        const chatId = sessionStorage.getItem('chatId') || window.chatId;
                
        if (!userChatId) {
            this.hideWidget();
            return;
        }

        try {
            // Use the new endpoint that's consistent with existing goals API
            const url = `/api/chat-goals/${userChatId}/milestones`;
            
            const response = await fetch(url, {
                credentials: 'include', // Include cookies for authentication
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[LiveGoals] Failed to load milestone goals:', response.status, response.statusText, errorText);
                console.error('[LiveGoals] Error response:', errorText);
                return;
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.updateGoalDisplay(data);
                this.showWidget();
            }
        } catch (error) {
            console.error('[LiveGoals] Error loading initial goal data:', error);
        }
    }

    async refreshGoalData() {
        const userChatId = sessionStorage.getItem('userChatId') || window.userChatId;
        
        if (!userChatId) {
            this.hideWidget();
            return;
        }

        try {
            const url = `/api/chat-goals/${userChatId}/milestones`;
            
            const response = await fetch(url, {
                credentials: 'include', // Include cookies for authentication
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[LiveGoals] Failed to refresh milestone goals:', response.status, response.statusText, errorText);
                console.error('[LiveGoals] Error response:', errorText);
                return;
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.updateGoalDisplay(data, true); // true for animated update
            }
        } catch (error) {
            console.error('[LiveGoals] Error refreshing goal data:', error);
        }
    }

    updateGoalDisplay(data, animated = false) {
        // The data comes from /api/chat-goals/:userChatId/milestones  
        // It returns milestoneGoals with images, videos, messages properties
        if (data.milestoneGoals) {
            const goals = data.milestoneGoals;
            
            // Update messages
            if (goals.messages) {
                this.updateGoalItem('messages', goals.messages.current, goals.messages.next, goals.messages.reward, animated);
            }

            // Update images  
            if (goals.images) {
                this.updateGoalItem('images', goals.images.current, goals.images.next, goals.images.reward, animated);
            }

            // Update videos
            if (goals.videos) {
                this.updateGoalItem('videos', goals.videos.current, goals.videos.next, goals.videos.reward, animated);
            }
        }
    }

    findNextMilestone(current, milestones) {
        for (let milestone of milestones) {
            if (current < milestone) {
                return milestone;
            }
        }
        return milestones[milestones.length - 1]; // Return last milestone if all completed
    }

    updateGoalItem(type, current, next, reward, animated = false) {
        const goalItem = $(`#goal-${type}`);
        const countSpan = goalItem.find('.goal-count');
        const rewardSpan = goalItem.find('.goal-reward');
        
        // Store previous value for animation
        const prevCurrent = this.currentGoals[type].current;
        this.currentGoals[type] = { current, next, milestone: next, reward };

        // Update count display
        if (!next || current >= next) {
            countSpan.text(`${current}✓`);
            goalItem.addClass('completed');
        } else {
            countSpan.text(`${current}/${next}`);
            goalItem.removeClass('completed near-completion');
            
            // Add visual feedback for progress
            if (current / next >= 0.8) {
                goalItem.addClass('near-completion');
            }
        }
        
        // Update circular progress
        const progressCircle = goalItem.find('.progress-ring-progress');
        if (progressCircle.length && next > 0) {
            const circumference = 2 * Math.PI * 20; // r=20
            const progressPercent = Math.min(current / next, 1);
            const offset = circumference * (1 - progressPercent);
            progressCircle.css('stroke-dashoffset', offset);
        }

        // Update reward points display
        if (reward) {
            rewardSpan.text(`+${reward}pts`);
            goalItem.attr('data-reward', reward);
        }

        // Update summary in toggle button
        this.updateToggleButtonSummary();

        // Animate if value increased
        if (animated && current > prevCurrent) {
            goalItem.addClass('updating');
            setTimeout(() => {
                goalItem.removeClass('updating');
            }, 600);

            // Show achievement notification for milestone completion
            if (next && current >= next && prevCurrent < next) {
                this.showMilestoneAchievement(type, next, reward);
            }
        }
    }

    showMilestoneAchievement(type, milestone, reward) {
        const typeNames = {
            messages: 'Messages',
            images: 'Images', 
            videos: 'Videos'
        };

        const notification = $(`
            <div class="achievement-notification" style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #ffd700, #ffed4e);
                color: #333;
                padding: 20px 30px;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(255, 215, 0, 0.3);
                z-index: 9999;
                text-align: center;
                animation: achievementPop 0.5s ease;
            ">
                <i class="bi bi-trophy" style="font-size: 2rem; color: #ff6b35;"></i>
                <h4 style="margin: 10px 0; font-weight: bold;">Goal Achieved!</h4>
                <p style="margin: 5px 0; font-size: 1.1rem;">${milestone} ${typeNames[type]} completed</p>
                <p style="margin: 0; font-size: 1.2rem; font-weight: bold; color: #28a745;">+${reward} Points Earned! 🎉</p>
            </div>
        `);

        $('body').append(notification);

        // Remove after 4 seconds
        setTimeout(() => {
            notification.fadeOut(500, function() {
                $(this).remove();
            });
        }, 4000);
    }

    handleLiveGoalsUpdate(data) {
        if (data.notification && data.notification.type === 'milestoneAchieved') {
            this.refreshGoalData();
            return true;
        }
        return false;
    }

    handleMilestoneAchieved(data) {
        this.refreshGoalData();
    }

    showWidget() {
        $('#live-goals-widget').show();
    }

    hideWidget() {
        $('#live-goals-widget').hide();
    }
    
    toggleExpanded() {
        this.isExpanded = !this.isExpanded;
        const panel = $('#goals-expanded-panel');
        
        if (this.isExpanded) {
            panel.addClass('show');
            // Refresh data when opening
            this.refreshGoalData();
        } else {
            panel.removeClass('show');
        }
    }
    
    collapse() {
        this.isExpanded = false;
        $('#goals-expanded-panel').removeClass('show');
    }
    
    updateToggleButtonSummary() {
        const total = this.currentGoals.messages.current + 
                     this.currentGoals.images.current + 
                     this.currentGoals.videos.current;
        const totalTarget = this.currentGoals.messages.next + 
                           this.currentGoals.images.next + 
                           this.currentGoals.videos.next;
        
        // Find next milestone reward
        let nextReward = 0;
        Object.values(this.currentGoals).forEach(goal => {
            if (goal.current < goal.next && goal.reward) {
                nextReward = Math.max(nextReward, goal.reward);
            }
        });
        
        $('.goals-total-progress').text(`${total}/${totalTarget}`);
        $('.goals-next-reward').text(`+${nextReward}`);
    }
    
    pulseToggleButton() {
        const toggleBtn = $('#goals-toggle-btn');
        toggleBtn.css('transform', 'translateY(-50%) scale(1.1)');
        setTimeout(() => {
            toggleBtn.css('transform', 'translateY(-50%) scale(1)');
        }, 200);
    }
    
    showMilestoneAchievement(type, milestone, reward) {
        const notification = $('#achievement-notification');
        const typeNames = {
            messages: 'Messages',
            images: 'Images', 
            videos: 'Videos'
        };
        
        notification.find('.achievement-title').text(`${milestone} ${typeNames[type]} Milestone!`);
        notification.find('.achievement-subtitle').text(`+${reward} points earned`);
        
        notification.addClass('show');
        setTimeout(() => {
            notification.removeClass('show');
        }, 3000);
    }

    resetWidget() {
        
        // Reset current goals data
        this.currentGoals = {
            messages: { current: 0, next: 10, milestone: 10, reward: 25 },
            images: { current: 0, next: 5, milestone: 5, reward: 250 },
            videos: { current: 0, next: 3, milestone: 3, reward: 500 }
        };
        
        // Collapse panel if expanded
        this.collapse();
        
        // Hide widget temporarily
        this.hideWidget();
        
        // Reset goal displays to default state
        const goalItems = $('#live-goals-widget .goal-item-compact');
        goalItems.removeClass('completed near-completion updating');
        
        // Reset progress circles
        goalItems.find('.progress-ring-progress').css('stroke-dashoffset', '125.6');
        
        // Reset toggle button summary
        $('.goals-total-progress').text('0/18');
        $('.goals-next-reward').text('+500');
        
        // Load fresh data for the new chat after a short delay
        setTimeout(() => {
            this.loadInitialData();
        }, 100);
    }

}

// Global function for programmatic toggle
window.toggleGoalsWidget = function() {
    if (window.liveGoalsWidget) {
        window.liveGoalsWidget.toggleExpanded();
    }
};

// Initialize when DOM is ready
$(document).ready(() => {
    // Only initialize in chat context
    if ($('#chat-wrapper').length > 0) {
        window.liveGoalsWidget = new LiveGoalsWidget();
        
        // Show/hide based on chat state
        $(document).on('chatOpened', () => {
            if (window.liveGoalsWidget) {
                // Small delay to ensure userChatId is set
                setTimeout(() => {
                    window.liveGoalsWidget.loadInitialData();
                }, 500);
            }
        });
        
        $(document).on('chatClosed', () => {
            if (window.liveGoalsWidget) {
                window.liveGoalsWidget.hideWidget();
            }
        });
    }
});

// Add achievement animation CSS
const achievementCSS = `
    @keyframes achievementPop {
        0% { 
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 0;
        }
        50% { 
            transform: translate(-50%, -50%) scale(1.1);
        }
        100% { 
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
        }
    }
`;

// Inject achievement animation CSS
if (!document.getElementById('achievement-styles')) {
    const style = document.createElement('style');
    style.id = 'achievement-styles';
    style.textContent = achievementCSS;
    document.head.appendChild(style);
}