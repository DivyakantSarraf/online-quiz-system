import { protectRoute, initNavbar } from "../auth.js";
import { isMock } from "../firebase-config.js";
import { injectMockNotice } from "../utils.js";
import { getAttemptsByStudent } from "../db.js";

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

  // Show user details
  document.getElementById("profile-display-name").textContent = user.displayName || "Student Profile";
  document.getElementById("profile-email").textContent = user.email;

  try {
    // Fetch user attempts
    const attempts = await getAttemptsByStudent(user.uid);

    // Hide loader, show main content
    document.getElementById("profile-loading").style.display = "none";
    document.getElementById("profile-main").style.display = "block";

    renderProfile(attempts);

  } catch (error) {
    console.error("Error loading student profile data:", error);
    document.getElementById("profile-loading").innerHTML = `
      <div style="font-size: 3rem;">❌</div>
      <p style="color: var(--color-danger); font-weight:600;">Failed to load profile details: ${error.message}</p>
    `;
  }
});

function renderProfile(attempts) {
  // Calculations
  const total = attempts.length;
  
  let avgPercentage = 0;
  if (total > 0) {
    const sum = attempts.reduce((acc, a) => acc + (a.percentage || 0), 0);
    avgPercentage = Math.round(sum / total);
  }

  const gradeWeights = { "A": 4, "B": 3, "C": 2, "F": 1 };
  let bestGrade = "-";
  let maxWeight = 0;
  attempts.forEach(a => {
    const weight = gradeWeights[a.grade] || 0;
    if (weight > maxWeight) {
      maxWeight = weight;
      bestGrade = a.grade;
    }
  });

  // Render Stats
  document.getElementById("total-attempts").textContent = total;
  document.getElementById("average-percentage").textContent = `${avgPercentage}%`;
  
  const bestGradeEl = document.getElementById("best-grade");
  bestGradeEl.textContent = bestGrade;
  if (bestGrade !== "-") {
    bestGradeEl.className = `stat-value grade-${bestGrade}`;
  }

  // Render Table
  const tbody = document.getElementById("history-tbody");
  const tableEl = document.querySelector(".history-table");
  const emptyEl = document.getElementById("history-empty");

  tbody.innerHTML = "";

  if (total === 0) {
    tableEl.style.display = "none";
    emptyEl.style.display = "block";
    return;
  }

  tableEl.style.display = "table";
  emptyEl.style.display = "none";

  attempts.forEach((att) => {
    const dateStr = formatDate(att.timestamp);
    const row = document.createElement("tr");
    
    row.innerHTML = `
      <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(att.quizTitle)}</td>
      <td style="text-align: center;">${att.score} / ${att.totalQuestions}</td>
      <td style="text-align: center; font-weight: 700; color: var(--accent-primary);">${att.percentage}%</td>
      <td style="text-align: center;"><span class="badge badge-custom">${att.grade}</span></td>
      <td style="text-align: right; color: var(--text-secondary); font-size: 0.9rem;">${dateStr}</td>
    `;

    // Row click redirects to the specific result page
    row.addEventListener("click", () => {
      window.location.href = `/result.html?attemptId=${att.id}`;
    });

    tbody.appendChild(row);
  });
}

// Helpers
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
    year: "numeric"
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
