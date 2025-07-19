/**
 * User Analytics English Translations
 */

window.userAnalyticsTranslations = {
  // Loading states
  loading: 'Loading...',
  loading_analytics: 'Loading analytics...',
  loading_history: 'Loading analytics history...',
  
  // Error messages
  error_loading_analytics: 'Error loading analytics',
  error_loading_history: 'Error loading analytics history',
  error_fetching_data: 'Error fetching analytics data',
  try_again: 'Try Again',
  
  // Success messages
  analytics_refreshed: 'Analytics refreshed',
  analytics_updated: 'Analytics updated successfully',
  
  // Analytics sections
  image_generation: 'Image Generation',
  likes_received: 'Likes Received',
  user_analytics: 'User Analytics',
  analytics_overview: 'Analytics Overview',
  
  // Stats labels
  total_images: 'Total Images',
  total_likes: 'Total Likes',
  this_month: 'This Month',
  this_week: 'This Week',
  today: 'Today',
  yesterday: 'Yesterday',
  
  // Image generation stats
  images_generated: 'Images Generated',
  favorite_chat: 'Favorite Chat',
  most_active_chat: 'Most Active Chat',
  generation_streak: 'Generation Streak',
  
  // Like stats
  likes_per_image: 'Likes per Image',
  most_liked_image: 'Most Liked Image',
  most_liked: 'Most Liked',
  average_likes: 'Average Likes',
  like_ratio: 'Like Ratio',
  
  // Time periods
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  all_time: 'All Time',
  
  // Chart labels
  generation_trend: 'Generation Trend',
  like_trend: 'Like Trend',
  activity_heatmap: 'Activity Heatmap',
  chat_breakdown: 'Chat Breakdown',
  
  // No data messages
  no_image_data: 'No image generation data available',
  no_like_data: 'No like data available',
  no_analytics_data: 'No analytics data available yet',
  no_activity: 'No activity recorded',
  
  // Modal and UI
  view_details: 'View Details',
  refresh_analytics: 'Refresh Analytics',
  export_data: 'Export Data',
  analytics_modal_title: 'Analytics Dashboard',
  close: 'Close',
  
  // History and trends
  analytics_history: 'Analytics History',
  view_history: 'View History',
  trend_analysis: 'Trend Analysis',
  performance_summary: 'Performance Summary',
  
  // Milestones and achievements
  milestones: 'Milestones',
  achievements: 'Achievements',
  milestone_reached: 'Milestone Reached!',
  first_image: 'First Image Generated',
  first_like: 'First Like Received',
  
  // Pagination
  previous: 'Previous',
  next: 'Next',
  page: 'Page',
  of: 'of',
  
  // Debug section
  debug_analytics: 'Debug Analytics',
  debug_images: 'Debug Images',
  debug_likes: 'Debug Likes',
  debug_all: 'Debug All',
  debug_completed: 'Debug completed - check console',
  
  // Rankings and comparisons
  your_rank: 'Your Rank',
  top_creator: 'Top Creator',
  above_average: 'Above Average',
  below_average: 'Below Average',
  
  // Engagement metrics
  engagement_rate: 'Engagement Rate',
  popularity_score: 'Popularity Score',
  creator_level: 'Creator Level',
  activity_score: 'Activity Score',
  
  // Time-based analytics
  peak_hours: 'Peak Hours',
  most_active_day: 'Most Active Day',
  creation_pattern: 'Creation Pattern',
  engagement_pattern: 'Engagement Pattern',
  
  // Social metrics
  community_impact: 'Community Impact',
  viral_content: 'Viral Content',
  trending_images: 'Trending Images',
  fan_favorite: 'Fan Favorite',
  
  // Streaks and consistency
  current_streak: 'Current Streak',
  longest_streak: 'Longest Streak',
  consistency_score: 'Consistency Score',
  daily_goal: 'Daily Goal',
  
  // Quality metrics
  quality_score: 'Quality Score',
  appreciation_index: 'Appreciation Index',
  creator_rating: 'Creator Rating',
  content_quality: 'Content Quality',
  
  // Progress tracking
  progress_this_month: 'Progress This Month',
  goals_achieved: 'Goals Achieved',
  targets_met: 'Targets Met',
  improvement_areas: 'Areas for Improvement',
  
  // Sharing and export
  share_stats: 'Share Stats',
  download_report: 'Download Report',
  analytics_report: 'Analytics Report',
  generated_on: 'Generated on',
  
  // Units and formatting
  images: 'images',
  likes: 'likes',
  days: 'days',
  hours: 'hours',
  minutes: 'minutes',
  percent: '%',
  
  // Status indicators
  improving: 'Improving',
  declining: 'Declining',
  stable: 'Stable',
  excellent: 'Excellent',
  good: 'Good',
  average: 'Average',
  needs_improvement: 'Needs Improvement'
};

// Also make available for server-side loading
if (typeof global !== 'undefined') {
  global.userAnalyticsTranslations = window.userAnalyticsTranslations;
}
