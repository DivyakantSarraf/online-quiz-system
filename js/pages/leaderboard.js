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
    const loadingEl = document.getElementById("leaderboard-loading");
    if (loadingEl) {
      loadingEl.innerHTML = "";
      const icon = document.createElement("div");
      icon.style.fontSize = "3rem";
      icon.textContent = "❌";
      loadingEl.appendChild(icon);

      const msg = document.createElement("p");
      msg.style.color = "var(--color-danger)";
      msg.style.fontWeight = "600";
      msg.textContent = `Failed to load leaderboard: ${error.message}`;
      loadingEl.appendChild(msg);

      const btn = document.createElement("a");
      btn.href = "/browse.html";
      btn.className = "btn btn-secondary btn-sm";
      btn.style.marginTop = "1rem";
      btn.textContent = "Back to Browse";
      loadingEl.appendChild(btn);
    }
  }
});

function createPodiumCol(rank, student) {
  const col = document.createElement("div");
  col.className = `podium-col ${rank}`;

  const medal = document.createElement("div");
  medal.className = "podium-medal";
  medal.textContent = rank === "first" ? "🥇" : rank === "second" ? "🥈" : "🥉";
  col.appendChild(medal);

  const avatar = document.createElement("div");
  avatar.className = "podium-avatar";
  avatar.textContent = rank === "first" ? "👑" : "👤";
  col.appendChild(avatar);

  const name = document.createElement("div");
  name.className = "podium-name";
  name.title = student.studentName;
  name.textContent = student.studentName;
  col.appendChild(name);

  const score = document.createElement("div");
  score.className = "podium-score";
  score.textContent = `${student.score} / ${student.totalQuestions}`;
  col.appendChild(score);

  const percentage = document.createElement("div");
  percentage.className = "podium-percentage";
  percentage.textContent = `${student.percentage}%`;
  col.appendChild(percentage);

  return col;
}

function renderLeaderboard(attempts) {
  const podiumSection = document.getElementById("podium-section");
  const tbody = document.getElementById("leaderboard-tbody");
  const emptyEl = document.getElementById("leaderboard-empty");
  const tableEl = document.querySelector(".leaderboard-table");
  const tableCard = document.getElementById("ranked-table-card");

  if (attempts.length === 0) {
    emptyEl.style.display = "block";
    tableEl.style.display = "none";
    podiumSection.style.display = "none";
    if (tableCard) tableCard.style.display = "block";
    return;
  }

  emptyEl.style.display = "none";
  podiumSection.style.display = "flex";
  podiumSection.innerHTML = "";

  // Podium (Top 3)
  const firstPlace = attempts.at(0);
  const secondPlace = attempts.at(1);
  const thirdPlace = attempts.at(2);

  if (secondPlace) {
    podiumSection.appendChild(createPodiumCol("second", secondPlace));
  }
  if (firstPlace) {
    podiumSection.appendChild(createPodiumCol("first", firstPlace));
  }
  if (thirdPlace) {
    podiumSection.appendChild(createPodiumCol("third", thirdPlace));
  }

  // Remaining list table
  tbody.innerHTML = "";
  if (attempts.length > 3) {
    if (tableCard) tableCard.style.display = "block";
    tableEl.style.display = "table";

    attempts.slice(3).forEach((att, index) => {
      const rankNum = index + 4;
      const dateStr = formatDate(att.timestamp);
      
      const row = document.createElement("tr");

      const tdRank = document.createElement("td");
      const rankBadge = document.createElement("span");
      rankBadge.className = "table-rank-badge";
      rankBadge.textContent = rankNum.toString();
      tdRank.appendChild(rankBadge);
      row.appendChild(tdRank);

      const tdName = document.createElement("td");
      tdName.style.fontWeight = "600";
      tdName.textContent = att.studentName;
      row.appendChild(tdName);

      const tdScore = document.createElement("td");
      tdScore.style.textAlign = "center";
      tdScore.textContent = `${att.score} / ${att.totalQuestions}`;
      row.appendChild(tdScore);

      const tdPct = document.createElement("td");
      tdPct.style.textAlign = "center";
      tdPct.style.fontWeight = "700";
      tdPct.style.color = "var(--accent-primary)";
      tdPct.textContent = `${att.percentage}%`;
      row.appendChild(tdPct);

      const tdGrade = document.createElement("td");
      tdGrade.style.textAlign = "center";
      const gradeBadge = document.createElement("span");
      gradeBadge.className = "badge badge-custom";
      gradeBadge.textContent = att.grade;
      tdGrade.appendChild(gradeBadge);
      row.appendChild(tdGrade);

      const tdDate = document.createElement("td");
      tdDate.style.textAlign = "right";
      tdDate.style.color = "var(--text-secondary)";
      tdDate.style.fontSize = "0.9rem";
      tdDate.textContent = dateStr;
      row.appendChild(tdDate);

      tbody.appendChild(row);
    });
  } else {
    if (tableCard) tableCard.style.display = "none";
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
