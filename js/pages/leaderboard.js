import { protectRoute, initNavbar } from "../auth.js";
import { isMock } from "../firebase-config.js";
import { injectMockNotice, showToast } from "../utils.js";
import { getQuiz, getLeaderboard } from "../db.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Inject mock warning banner if mock mode active
  injectMockNotice(isMock);

  // Route protection - redirect to login.html if not logged in
  const user = await protectRoute();
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  // Initialize navbar links
  initNavbar();

  // Read URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const quizId = urlParams.get("quizId");
  const attemptId = urlParams.get("attemptId");

  if (!quizId) {
    showToast("Invalid quiz standings link. Redirecting...", "error");
    setTimeout(() => {
      window.location.href = "/browse.html";
    }, 1500);
    return;
  }

  // Back to Results button link configuration
  if (attemptId) {
    const backBtn = document.getElementById("back-to-results-btn");
    if (backBtn) {
      backBtn.href = `/result.html?attemptId=${attemptId}`;
      backBtn.style.display = "inline-flex";
    }
  }

  try {
    // Fetch quiz meta
    const quiz = await getQuiz(quizId);
    document.getElementById("leaderboard-title").textContent = `${quiz.title} Standings`;
    document.getElementById("leaderboard-meta").textContent = `Category: ${quiz.category} • Difficulty: ${quiz.difficulty}`;

    // Fetch and sort attempts
    const rawAttempts = await getLeaderboard(quizId);

    // Group attempts by studentId and keep only the best attempt per student
    const bestAttemptsMap = new Map();
    rawAttempts.forEach(attempt => {
      const studentId = attempt.studentId;
      if (!bestAttemptsMap.has(studentId)) {
        bestAttemptsMap.set(studentId, attempt);
      } else {
        const existing = bestAttemptsMap.get(studentId);
        if (attempt.percentage > existing.percentage) {
          bestAttemptsMap.set(studentId, attempt);
        } else if (attempt.percentage === existing.percentage) {
          // Keep earliest timestamp on tie
          if (getTimestampMs(attempt.timestamp) < getTimestampMs(existing.timestamp)) {
            bestAttemptsMap.set(studentId, attempt);
          }
        }
      }
    });

    const uniqueAttempts = Array.from(bestAttemptsMap.values());
    const attempts = uniqueAttempts.sort((a, b) => {
      if (b.percentage !== a.percentage) {
        return b.percentage - a.percentage;
      }
      return getTimestampMs(a.timestamp) - getTimestampMs(b.timestamp);
    });

    // Hide loader, show main content
    document.getElementById("leaderboard-loading").style.display = "none";
    document.getElementById("leaderboard-main").style.display = "block";

    renderLeaderboard(attempts);

  } catch (error) {
    console.error("Error loading leaderboard details:", error);
    document.getElementById("leaderboard-loading").innerHTML = `
      <div style="font-size: 3rem;">❌</div>
      <p style="color: var(--color-danger); font-weight:600;">Failed to load leaderboard: ${error.message}</p>
      <a href="/browse.html" class="btn btn-secondary btn-sm" style="margin-top: 1rem;">Back to Browse</a>
    `;
  }
});

function renderLeaderboard(attempts) {
  const podiumSection = document.getElementById("podium-section");
  const tbody = document.getElementById("leaderboard-tbody");
  const emptyEl = document.getElementById("leaderboard-empty");
  const tableEl = document.querySelector(".leaderboard-table");

  if (attempts.length === 0) {
    emptyEl.style.display = "block";
    tableEl.style.display = "none";
    podiumSection.style.display = "none";
    return;
  }

  emptyEl.style.display = "none";
  tableEl.style.display = "table";

  // Podium (Top 3)
  const firstPlace = attempts[0];
  const secondPlace = attempts[1];
  const thirdPlace = attempts[2];

  let podiumHTML = "";
  if (secondPlace) {
    podiumHTML += `
      <div class="podium-col second">
        <div class="podium-medal">🥈</div>
        <div class="podium-avatar">👤</div>
        <div class="podium-name" title="${escapeHtml(secondPlace.studentName)}">${escapeHtml(secondPlace.studentName)}</div>
        <div class="podium-score">${secondPlace.score} / ${secondPlace.totalQuestions}</div>
        <div class="podium-percentage">${secondPlace.percentage}%</div>
      </div>
    `;
  }
  if (firstPlace) {
    podiumHTML += `
      <div class="podium-col first">
        <div class="podium-medal">🥇</div>
        <div class="podium-avatar">👑</div>
        <div class="podium-name" title="${escapeHtml(firstPlace.studentName)}">${escapeHtml(firstPlace.studentName)}</div>
        <div class="podium-score">${firstPlace.score} / ${firstPlace.totalQuestions}</div>
        <div class="podium-percentage">${firstPlace.percentage}%</div>
      </div>
    `;
  }
  if (thirdPlace) {
    podiumHTML += `
      <div class="podium-col third">
        <div class="podium-medal">🥉</div>
        <div class="podium-avatar">👤</div>
        <div class="podium-name" title="${escapeHtml(thirdPlace.studentName)}">${escapeHtml(thirdPlace.studentName)}</div>
        <div class="podium-score">${thirdPlace.score} / ${thirdPlace.totalQuestions}</div>
        <div class="podium-percentage">${thirdPlace.percentage}%</div>
      </div>
    `;
  }

  podiumSection.innerHTML = podiumHTML;
  podiumSection.style.display = "flex";

  // Remaining list table
  tbody.innerHTML = "";
  if (attempts.length > 3) {
    for (let i = 3; i < attempts.length; i++) {
      const att = attempts[i];
      const dateStr = formatDate(att.timestamp);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><span class="table-rank-badge">${i + 1}</span></td>
        <td style="font-weight: 600;">${escapeHtml(att.studentName)}</td>
        <td style="text-align: center;">${att.score} / ${att.totalQuestions}</td>
        <td style="text-align: center; font-weight: 700; color: var(--accent-primary);">${att.percentage}%</td>
        <td style="text-align: center;"><span class="badge badge-custom">${att.grade}</span></td>
        <td style="text-align: right; color: var(--text-secondary); font-size: 0.9rem;">${dateStr}</td>
      `;
      tbody.appendChild(row);
    }
  }
}

// Helpers
function getTimestampMs(ts) {
  if (!ts) return Date.now();
  if (ts.seconds !== undefined) {
    return ts.seconds * 1000 + Math.floor(ts.nanoseconds / 1000000);
  }
  return new Date(ts).getTime();
}

function formatDate(ts) {
  if (!ts) return "-";
  let date;
  if (ts.seconds !== undefined) {
    date = new Date(ts.seconds * 1000);
  } else {
    date = new Date(ts);
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
