import { onAuthChanged, initNavbar } from "../auth.js";
import { isMock } from "../firebase-config.js";
import { injectMockNotice } from "../utils.js";

document.addEventListener("DOMContentLoaded", () => {
  // Inject banner notice if running on LocalStorage fallback
  injectMockNotice(isMock);

  // Initialize shared navbar
  initNavbar();

  const heroCtas = document.getElementById("hero-ctas");

  // Track auth changes to update hero CTAs
  onAuthChanged((user) => {
    updateHeroCtas(user);
  });

  // Adjust CTA links based on log state
  function updateHeroCtas(user) {
    if (!heroCtas) return;
    
    if (user) {
      if (user.role === "admin") {
        heroCtas.innerHTML = `
          <a href="/admin-dashboard.html" class="btn btn-primary">Go to Admin Dashboard</a>
          <a href="/quiz-creator.html" class="btn btn-secondary">Create a New Quiz</a>
        `;
      } else {
        heroCtas.innerHTML = `
          <a href="/browse.html" class="btn btn-primary">Browse All Quizzes</a>
          <a href="/profile.html" class="btn btn-secondary">View My Performance</a>
        `;
      }
    } else {
      heroCtas.innerHTML = `
        <a href="/login.html" class="btn btn-primary">Attempt a Quiz</a>
        <a href="/register.html" class="btn btn-secondary">Student Registration</a>
        <a href="/admin-login.html" class="btn btn-outline">Admin Portal</a>
      `;
    }
  }
});
