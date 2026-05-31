// Toast Notifications
export function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Icon based on type
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  // Remove toast after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Add CSS keyframe for slideOut if not present
if (!document.getElementById('toast-keyframes')) {
  const style = document.createElement('style');
  style.id = 'toast-keyframes';
  style.innerHTML = `
    @keyframes slideOut {
      to { transform: translateX(120%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// Fisher-Yates Shuffle Algorithm
export function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Obfuscate answer (Base64)
export function obfuscate(text) {
  try {
    return btoa(encodeURIComponent(text));
  } catch (e) {
    return text;
  }
}

// De-obfuscate answer
export function deobfuscate(hash) {
  try {
    return decodeURIComponent(atob(hash));
  } catch (e) {
    return hash;
  }
}

// Format duration from seconds to MM:SS
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Generate shareable link for a quiz
export function getShareableLink(quizId) {
  const url = new URL(window.location.href);
  return `${url.origin}/attempt.html?quizId=${quizId}`;
}

// Display mock mode notice if running in mock mode
export function injectMockNotice(isMock) {
  if (!isMock) return;
  
  // Check if already injected
  if (document.querySelector('.mock-notice-bar')) return;

  const bar = document.createElement('div');
  bar.className = 'mock-notice-bar';
  bar.style.cssText = `
    background: linear-gradient(90deg, #f59e0b, #d97706);
    color: #0b0f19;
    text-align: center;
    padding: 0.5rem;
    font-size: 0.85rem;
    font-weight: 700;
    position: sticky;
    top: 0;
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  `;
  bar.innerHTML = `
    <span>⚠️ Offline/Demo Mode active (LocalStorage). Configure Firebase in <code>js/firebase-env.js</code> for real-time cloud data.</span>
  `;
  
  // Inject at the very top of body
  document.body.insertBefore(bar, document.body.firstChild);
  
  // Make sure navbar sits below notice
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    navbar.style.top = bar.offsetHeight + 'px';
  }
}

// Generate a random ID (useful for Mock mode)
export function generateUUID() {
  return 'quiz-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
}
