/**
 * Formats a date string into a readable format
 * @param dateString - The date string to format or null
 * @returns Formatted date string or 'Not recorded' if null
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return 'Not recorded';
  
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { 
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) + ' at ' + date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Formats a date string into a relative format (Today, Yesterday, or date)
 * @param dateString - The date string to format
 * @returns Relative date description
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}

/**
 * Calculates a readable duration from seconds
 * @param seconds - Duration in seconds or null
 * @returns Formatted duration string
 */
export function calculateDuration(seconds: number | null): string {
  if (!seconds) return '0m 0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  let result = '';
  if (hours > 0) {
    result += `${hours}h `;
  }
  if (minutes > 0 || hours > 0) {
    result += `${minutes}m `;
  }
  result += `${remainingSeconds}s`;
  
  return result;
} 