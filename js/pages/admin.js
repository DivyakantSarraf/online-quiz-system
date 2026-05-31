import { protectRoute, initNavbar } from "../auth.js";
import { isMock } from "../firebase-config.js";
import { injectMockNotice, showToast } from "../utils.js";
import { getQuizzesByAdmin, getAttemptsByAdmin, deleteQuiz } from "../db.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Inject banner notice if mock mode
  injectMockNotice(isMock);

  // Guard route - requires 'admin' role
  const adminUser = await protectRoute("admin");
  if (!adminUser) return;

  // Initialize navbar
  initNavbar();

  // Load Dashboard Data
  await loadDashboard(adminUser.uid);
});

async function loadDashboard(adminUid) {
  try {
    const quizzes = await getQuizzesByAdmin(adminUid);
    const attempts = await getAttemptsByAdmin(adminUid);

    renderStats(quizzes, attempts);
    renderQuizzes(quizzes, adminUid);
    renderAttempts(attempts);
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    showToast("Error loading dashboard stats.", "error");
  }
}

function renderStats(quizzes, attempts) {
  const quizCountEl = document.getElementById("stat-quizzes");
  const attemptCountEl = document.getElementById("stat-attempts");
  const avgScoreEl = document.getElementById("stat-avg-score");

  if (quizCountEl) quizCountEl.textContent = quizzes.length;
  if (attemptCountEl) attemptCountEl.textContent = attempts.length;

  if (avgScoreEl) {
    if (attempts.length === 0) {
      avgScoreEl.textContent = "0%";
    } else {
      const sum = attempts.reduce((acc, curr) => acc + (curr.percentage || 0), 0);
      avgScoreEl.textContent = Math.round(sum / attempts.length) + "%";
    }
  }
}

function renderQuizzes(quizzes, adminUid) {
  const container = document.getElementById("quizzes-container");
  if (!container) return;

  if (quizzes.length === 0) {
    container.innerHTML = `
      <div class="empty-placeholder">
        <span>📚</span>
        <p>You haven't created any quizzes yet.</p>
      </div>
    `;
    return;
  }

  let html = "";
  quizzes.forEach((quiz) => {
    const statusBadge = quiz.isPublished 
      ? `<span class="badge badge-published">Published</span>` 
      : `<span class="badge badge-draft">Draft</span>`;
    
    const diffClass = `badge-${quiz.difficulty.toLowerCase()}`;
    const diffBadge = `<span class="badge ${diffClass}">${quiz.difficulty}</span>`;
    
    const questionText = quiz.questions 
      ? `${quiz.questions.length} ${quiz.questions.length === 1 ? 'Question' : 'Questions'}` 
      : '0 Questions';

    const timerText = quiz.timer > 0 ? `⏱️ ${quiz.timer}m` : '⏱️ Untimed';
    const passwordText = quiz.password ? '🔒 Locked' : '🔓 Public';

    html += `
      <div class="quiz-list-item" id="quiz-card-${quiz.id}">
        <div class="quiz-info">
          <h3>${escapeHtml(quiz.title)}</h3>
          <div class="quiz-meta">
            ${statusBadge}
            ${diffBadge}
            <span>${escapeHtml(quiz.category)}</span>
            <span>•</span>
            <span>${questionText}</span>
            <span>•</span>
            <span>${timerText}</span>
            <span>•</span>
            <span>${passwordText}</span>
          </div>
        </div>
        <div class="quiz-actions">
          <button class="btn btn-outline btn-xs copy-link-btn" data-id="${quiz.id}">🔗 Link</button>
          <a href="/quiz-creator.html?editId=${quiz.id}" class="btn btn-secondary btn-xs">✏️ Edit</a>
          <button class="btn btn-outline btn-xs delete-quiz-btn" data-id="${quiz.id}" style="color: var(--color-danger); border-color: rgba(239, 68, 68, 0.2);">🗑️ Delete</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Add Action Event Listeners
  container.querySelectorAll(".copy-link-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const quizId = btn.getAttribute("data-id");
      const shareUrl = `${window.location.origin}/attempt.html?quizId=${quizId}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("Quiz shareable link copied to clipboard!", "success");
      }).catch(() => {
        showToast("Failed to copy link.", "error");
      });
    });
  });

  container.querySelectorAll(".delete-quiz-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const quizId = btn.getAttribute("data-id");
      if (confirm("Are you sure you want to delete this quiz? All associated student attempt data remains but the quiz metadata will be gone.")) {
        try {
          await deleteQuiz(quizId);
          showToast("Quiz deleted successfully.", "success");
          // Reload dashboard data
          await loadDashboard(adminUid);
        } catch (err) {
          showToast("Failed to delete quiz: " + err.message, "error");
        }
      }
    });
  });
}

function renderAttempts(attempts) {
  const container = document.getElementById("attempts-container");
  if (!container) return;

  if (attempts.length === 0) {
    container.innerHTML = `
      <div class="empty-placeholder">
        <span>📊</span>
        <p>No student attempt data available yet.</p>
      </div>
    `;
    return;
  }

  let tableHtml = `
    <div class="table-wrapper">
      <table class="attempts-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Quiz</th>
            <th>Score</th>
            <th>Grade</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
  `;

  attempts.forEach((a) => {
    const formattedDate = a.timestamp 
      ? formatDate(a.timestamp) 
      : new Date().toLocaleDateString();

    const scoreFraction = `${a.score} / ${a.totalQuestions}`;
    const gradeClass = `grade-${a.grade}`;

    tableHtml += `
      <tr>
        <td style="font-weight: 500;">${escapeHtml(a.studentName)}</td>
        <td>${escapeHtml(a.quizTitle)}</td>
        <td>
          <div style="font-weight: 600;">${a.percentage}%</div>
          <small style="color: var(--text-secondary);">${scoreFraction}</small>
        </td>
        <td>
          <span class="grade-badge ${gradeClass}">${a.grade}</span>
        </td>
        <td style="color: var(--text-secondary); font-size: 0.85rem;">${formattedDate}</td>
      </tr>
    `;
  });

  tableHtml += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = tableHtml;
}

// Helpers
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(timestamp) {
  // Handles Firestore timestamps or ISO strings
  const date = timestamp.seconds 
    ? new Date(timestamp.seconds * 1000) 
    : new Date(timestamp);
  return date.toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}
