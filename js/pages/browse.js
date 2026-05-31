import { protectRoute, initNavbar } from "../auth.js";
import { isMock } from "../firebase-config.js";
import { injectMockNotice, showToast } from "../utils.js";
import { getAllPublishedQuizzes, getAttemptsByStudent } from "../db.js";

// Page state
let allQuizzes = [];
let filteredQuizzes = [];
let activeCategories = new Set();
let activeDifficulties = new Set();
let searchQuery = "";
let selectedQuiz = null;
let activeStudent = null;
let studentAttempts = [];

document.addEventListener("DOMContentLoaded", async () => {
  // Inject mock warning banner if mock mode active
  injectMockNotice(isMock);

  // Protect route - requires student registration or login to view
  activeStudent = await protectRoute("student");
  if (!activeStudent) return;

  // Initialize navbar links
  initNavbar();

  // Load published quizzes
  await loadQuizzes();

  // Setup Event Listeners
  setupFilters();
});

async function loadQuizzes() {
  try {
    allQuizzes = await getAllPublishedQuizzes();
    filteredQuizzes = [...allQuizzes];

    if (activeStudent) {
      studentAttempts = await getAttemptsByStudent(activeStudent.uid);
    }

    buildDynamicCategories();
    renderQuizzes();
  } catch (error) {
    console.error("Error loading published quizzes:", error);
    showToast("Failed to fetch available quizzes.", "error");
  }
}

// Extract unique categories from Firestore and build checklist checkboxes dynamically
function buildDynamicCategories() {
  const container = document.getElementById("category-filter-group");
  if (!container) return;

  // Predefined list
  const fixed = ["Maths", "Science", "English", "Computer", "History"];
  
  // Find custom ones
  const customCategories = allQuizzes
    .map(q => q.category)
    .filter(cat => cat && !fixed.includes(cat));
  
  const uniqueCustom = [...new Set(customCategories)];

  // Clear current innerHTML and rebuild to ensure we don't duplicate
  let html = "";
  
  // Render fixed
  fixed.forEach(cat => {
    html += `
      <label class="checkbox-label">
        <input type="checkbox" value="${cat}" class="category-checkbox"> ${cat}
      </label>
    `;
  });

  // Render custom dynamically
  uniqueCustom.forEach(cat => {
    html += `
      <label class="checkbox-label" style="color: var(--color-primary-light);">
        <input type="checkbox" value="${cat}" class="category-checkbox"> ${cat} 🏷️
      </label>
    `;
  });

  container.innerHTML = html;
}

function setupFilters() {
  // Title Search Listener
  const searchInput = document.getElementById("search-bar");
  searchInput?.addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    applyFilters();
  });

  // Checklist Checkbox Listeners (Delegation)
  document.addEventListener("change", (e) => {
    if (e.target.classList.contains("category-checkbox")) {
      const val = e.target.value;
      if (e.target.checked) {
        activeCategories.add(val);
      } else {
        activeCategories.delete(val);
      }
      applyFilters();
    }

    if (e.target.parentNode?.parentNode?.id === "difficulty-filter-group") {
      const val = e.target.value;
      if (e.target.checked) {
        activeDifficulties.add(val);
      } else {
        activeDifficulties.delete(val);
      }
      applyFilters();
    }
  });
}

function applyFilters() {
  filteredQuizzes = allQuizzes.filter((quiz) => {
    // 1. Title Search Filter
    const matchesSearch = quiz.title.toLowerCase().includes(searchQuery);

    // 2. Category Filter
    const matchesCategory = activeCategories.size === 0 || activeCategories.has(quiz.category);

    // 3. Difficulty Filter
    const matchesDifficulty = activeDifficulties.size === 0 || activeDifficulties.has(quiz.difficulty);

    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  renderQuizzes();
}

function renderQuizzes() {
  const container = document.getElementById("quizzes-grid");
  if (!container) return;

  if (filteredQuizzes.length === 0) {
    container.innerHTML = `
      <div class="empty-placeholder" style="grid-column: 1/-1;">
        <span>🔍</span>
        <h3>No quizzes match your filters</h3>
        <p style="color: var(--text-secondary); margin-top:0.25rem;">Try modifying your keyword search or category checklist selections.</p>
      </div>
    `;
    return;
  }

  let html = "";
  filteredQuizzes.forEach((quiz) => {
    const diffClass = `badge-${quiz.difficulty.toLowerCase()}`;
    const diffBadge = `<span class="badge ${diffClass}">${quiz.difficulty}</span>`;
    
    const questionText = quiz.questions 
      ? `${quiz.questions.length} ${quiz.questions.length === 1 ? 'Question' : 'Questions'}` 
      : '0 Questions';

    const timerText = quiz.timer > 0 ? `⏱️ ${quiz.timer}m` : '⏱️ Untimed';
    const passwordBadge = quiz.password 
      ? `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b;">🔒 Password</span>` 
      : `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">🔓 Free</span>`;

    let attemptsText = "Unlimited";
    if (quiz.maxAttempts !== undefined && quiz.maxAttempts !== null && quiz.maxAttempts !== "") {
      const count = studentAttempts.filter(a => a.quizId === quiz.id).length;
      const remaining = Math.max(0, quiz.maxAttempts - count);
      attemptsText = `${remaining} attempts remaining`;
    }

    html += `
      <div class="glass-card quiz-card" data-id="${quiz.id}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 0.5rem; flex-wrap:wrap; gap:0.5rem;">
          <span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary); font-weight:600;">${escapeHtml(quiz.category)}</span>
          ${passwordBadge}
        </div>
        <h3>${escapeHtml(quiz.title)}</h3>
        <p>${escapeHtml(quiz.description)}</p>
        <div class="quiz-card-footer">
          ${diffBadge}
          <span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; font-weight:600;">${questionText}</span>
          <span class="badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-secondary); font-weight:600;">${timerText}</span>
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight:600;">${attemptsText}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Add click listeners to navigate or open password overlay
  container.querySelectorAll(".quiz-card").forEach((card) => {
    card.addEventListener("click", () => {
      const quizId = card.getAttribute("data-id");
      const quiz = allQuizzes.find(q => q.id === quizId);
      if (quiz) {
        handleQuizClick(quiz);
      }
    });
  });
}

function handleQuizClick(quiz) {
  window.location.href = `/attempt.html?quizId=${quiz.id}`;
}

// Helpers
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
