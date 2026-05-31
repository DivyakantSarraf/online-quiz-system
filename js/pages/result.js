import { protectRoute, initNavbar } from "../auth.js";
import { isMock } from "../firebase-config.js";
import { injectMockNotice, showToast, deobfuscate } from "../utils.js";
import { getQuiz, getAttempt } from "../db.js";

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

  // Read attempt ID from URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const attemptId = urlParams.get("attemptId");

  if (!attemptId) {
    showToast("Invalid result link. Redirecting...", "error");
    setTimeout(() => {
      window.location.href = "/browse.html";
    }, 1500);
    return;
  }

  try {
    // Fetch attempt details
    const attempt = await getAttempt(attemptId);
    
    // Fetch original quiz details
    const quiz = await getQuiz(attempt.quizId);

    // Hide loader, show main content
    document.getElementById("result-loading").style.display = "none";
    document.getElementById("result-main").style.display = "block";

    // Render stats and review
    renderResultPage(attempt, quiz);

  } catch (error) {
    console.error("Error loading quiz result session:", error);
    document.getElementById("result-loading").innerHTML = `
      <div style="font-size: 3rem;">❌</div>
      <p style="color: var(--color-danger); font-weight:600;">Failed to load results: ${error.message}</p>
      <a href="/browse.html" class="btn btn-secondary btn-sm" style="margin-top: 1rem;">Back to Browse</a>
    `;
  }
});

function renderResultPage(attempt, quiz) {
  // Header Meta
  document.getElementById("quiz-title-display").textContent = quiz.title;
  document.getElementById("quiz-meta-display").textContent = `Category: ${quiz.category} • Difficulty: ${quiz.difficulty} • Taken by ${attempt.studentName}`;

  // Score
  document.getElementById("score-display").textContent = `${attempt.score} / ${attempt.totalQuestions}`;
  
  // Percentage
  document.getElementById("percentage-display").textContent = `${attempt.percentage}%`;

  // Grade
  const gradeEl = document.getElementById("grade-display");
  gradeEl.textContent = attempt.grade;
  gradeEl.className = `stat-value grade-${attempt.grade}`;

  // Time Spent
  const minutes = Math.floor(attempt.timeSpent / 60);
  const seconds = attempt.timeSpent % 60;
  const timeSpentString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  document.getElementById("time-display").textContent = timeSpentString;

  // Render question reviews
  const reviewContainer = document.getElementById("review-questions-container");
  if (!reviewContainer) return;
  reviewContainer.innerHTML = "";

  quiz.questions.forEach((q, idx) => {
    const studentAns = attempt.answers[q.id];
    
    // Check correctness
    const isCorrect = isAnswerCorrect(q, studentAns);
    
    // Construct question review card
    const card = document.createElement("div");
    card.className = `glass-card review-card ${isCorrect ? 'correct' : 'incorrect'}`;
    
    // Badge status
    const badge = isCorrect ? "✅" : "❌";
    
    // Header section of the question review
    let cardHTML = `
      <div class="review-status-badge">${badge}</div>
      <div class="review-question-text">
        <span style="color: var(--accent-primary); font-weight: 700; margin-right: 0.5rem;">Q${idx + 1}.</span> 
        ${escapeHtml(q.text)}
      </div>
      <div class="review-choices">
    `;

    // Deobfuscate correct answer value
    let correctVal;
    try {
      correctVal = JSON.parse(deobfuscate(q.correctAnswer));
    } catch (err) {
      correctVal = q.correctAnswer;
    }

    if (q.type === "mcq" || q.type === "multi") {
      q.options.forEach((optText, optIdx) => {
        let isCorrectChoice = false;
        let isStudentSelected = false;

        if (q.type === "mcq") {
          isCorrectChoice = optIdx === correctVal;
          isStudentSelected = studentAns === optIdx;
        } else if (q.type === "multi") {
          isCorrectChoice = Array.isArray(correctVal) && correctVal.includes(optIdx);
          isStudentSelected = Array.isArray(studentAns) && studentAns.includes(optIdx);
        }

        let itemClass = "review-choice-item";
        let marker = q.type === "multi" ? "⬜" : "⚪";

        if (isCorrectChoice) {
          if (isStudentSelected) {
            itemClass += " student-correct";
            marker = "✅";
          } else {
            itemClass += " correct-answer-missed";
            marker = "⭐";
          }
        } else {
          if (isStudentSelected) {
            itemClass += " student-incorrect";
            marker = "❌";
          }
        }

        cardHTML += `
          <div class="${itemClass}">
            <span class="choice-marker">${marker}</span>
            <span>${escapeHtml(optText)}</span>
          </div>
        `;
      });
    } else if (q.type === "tf") {
      const tfOptions = ["True", "False"];
      tfOptions.forEach((optText) => {
        const isCorrectChoice = optText === correctVal;
        const isStudentSelected = studentAns === optText;

        let itemClass = "review-choice-item";
        let marker = "⚪";

        if (isCorrectChoice) {
          if (isStudentSelected) {
            itemClass += " student-correct";
            marker = "✅";
          } else {
            itemClass += " correct-answer-missed";
            marker = "⭐";
          }
        } else {
          if (isStudentSelected) {
            itemClass += " student-incorrect";
            marker = "❌";
          }
        }

        cardHTML += `
          <div class="${itemClass}">
            <span class="choice-marker">${marker}</span>
            <span>${optText}</span>
          </div>
        `;
      });
    }

    cardHTML += `
      </div>
    `;

    card.innerHTML = cardHTML;
    reviewContainer.appendChild(card);
  });

  // Buttons Links
  document.getElementById("browse-btn").href = "/browse.html";
  document.getElementById("leaderboard-btn").href = `/leaderboard.html?quizId=${quiz.id}&attemptId=${attempt.id}`;
}

function isAnswerCorrect(q, studentAns) {
  let correctVal;
  try {
    correctVal = JSON.parse(deobfuscate(q.correctAnswer));
  } catch (err) {
    correctVal = q.correctAnswer;
  }

  if (q.type === "mcq" || q.type === "tf") {
    return studentAns !== undefined && studentAns === correctVal;
  } else if (q.type === "multi") {
    if (Array.isArray(studentAns) && Array.isArray(correctVal)) {
      const sSorted = [...studentAns].sort().toString();
      const cSorted = [...correctVal].sort().toString();
      return sSorted === cSorted;
    }
  }
  return false;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
