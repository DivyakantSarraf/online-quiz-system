import { protectRoute, initNavbar } from "../auth.js";
import { isMock } from "../firebase-config.js";
import { injectMockNotice, showToast, shuffleArray, deobfuscate } from "../utils.js";
import { getQuiz, saveAttempt, getAttemptsByStudent } from "../db.js";

// Attempt State Variables
let activeStudent = null;
let quiz = null;
let quizId = null;
let shuffledQuestions = [];
let studentAnswers = {}; // Map of question.id -> selected answer (original index or string)
let currentIdx = 0;
let timerInterval = null;
let totalSeconds = 0;
let timeRemaining = 0;
let timerStart = null;

document.addEventListener("DOMContentLoaded", async () => {
  // Inject mock warning banner if mock mode active
  injectMockNotice(isMock);

  // Protect route - requires student role
  activeStudent = await protectRoute("student");
  if (!activeStudent) return;

  // Initialize navbar links
  initNavbar();

  // Read quiz ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  quizId = urlParams.get("quizId");

  if (!quizId) {
    showToast("Invalid quiz link. Redirecting...", "error");
    setTimeout(() => {
      window.location.href = "/browse.html";
    }, 1500);
    return;
  }

  // Fetch quiz details
  try {
    quiz = await getQuiz(quizId);

    // Enforce Max Attempts limit check
    if (quiz.maxAttempts !== undefined && quiz.maxAttempts !== null && quiz.maxAttempts !== "") {
      const studentAttempts = await getAttemptsByStudent(activeStudent.uid);
      const prevAttemptsCount = studentAttempts.filter(a => a.quizId === quizId).length;
      if (prevAttemptsCount >= quiz.maxAttempts) {
        showToast("You have reached the maximum attempts for this quiz", "error");
        setTimeout(() => {
          window.location.href = "/browse.html";
        }, 1500);
        return;
      }
    }

    document.getElementById("attempt-loading").style.display = "none";
    
    // Check if password gate is needed
    if (quiz.password && sessionStorage.getItem("pwd_verified_" + quizId) !== "true") {
      showPasswordGate();
    } else {
      startQuiz();
    }
  } catch (error) {
    console.error("Error loading quiz attempt session:", error);
    document.getElementById("attempt-loading").innerHTML = `
      <div style="font-size: 3rem;">❌</div>
      <p style="color: var(--color-danger); font-weight:600;">Failed to load quiz attempt: ${error.message}</p>
      <a href="/browse.html" class="btn btn-secondary btn-sm" style="margin-top: 1rem;">Back to Browse</a>
    `;
  }
});

function showPasswordGate() {
  const gate = document.getElementById("attempt-password-gate");
  const gateTitle = document.getElementById("gate-quiz-title");
  const form = document.getElementById("gate-submit-form");
  const passwordInput = document.getElementById("gate-quiz-password");
  const errorEl = document.getElementById("gate-error-message");

  if (gate && gateTitle) {
    gateTitle.textContent = quiz.title;
    gate.style.display = "flex";
  }

  passwordInput?.addEventListener("input", () => {
    if (errorEl) {
      errorEl.style.display = "none";
      errorEl.textContent = "";
    }
  });

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const entered = passwordInput.value.trim();

    if (entered === quiz.password) {
      sessionStorage.setItem("pwd_verified_" + quizId, "true");
      gate.style.display = "none";
      startQuiz();
    } else {
      if (errorEl) {
        errorEl.textContent = "Incorrect password. Please try again.";
        errorEl.style.display = "block";
      }
    }
  });
}

function startQuiz() {
  document.getElementById("attempt-main").style.display = "block";
  document.getElementById("quiz-title-display").textContent = quiz.title;
  document.getElementById("quiz-category-display").textContent = `Category: ${quiz.category} • Difficulty: ${quiz.difficulty}`;

  // 1. Prepare and Shuffle Questions & Options
  initializeQuestions();

  // 2. Restore Draft Answers from sessionStorage if present
  restoreDraftAnswers();

  // 3. Initialize Timer if quiz has timer
  initializeTimer();

  // 4. Render First Question
  renderQuestion();

  // Event Listeners for Nav buttons
  document.getElementById("prev-btn")?.addEventListener("click", navigatePrevious);
  document.getElementById("next-btn")?.addEventListener("click", navigateNext);
  document.getElementById("submit-btn")?.addEventListener("click", handleSubmitAttempt);

  // Menu Dropdown Logic
  const menuBtn = document.getElementById("menu-dots-btn");
  const dropdownContent = document.getElementById("menu-dropdown-content");
  const exitBtn = document.getElementById("exit-quiz-btn");
  const exitModal = document.getElementById("exit-confirm-modal");
  const cancelExitBtn = document.getElementById("exit-cancel-btn");
  const confirmExitBtn = document.getElementById("exit-confirm-btn");

  menuBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dropdownContent) {
      const isVisible = dropdownContent.style.display === "block";
      dropdownContent.style.display = isVisible ? "none" : "block";
    }
  });

  // Clicking anywhere outside the dropdown closes it automatically
  document.addEventListener("click", (e) => {
    if (dropdownContent && !menuBtn?.contains(e.target) && !dropdownContent.contains(e.target)) {
      dropdownContent.style.display = "none";
    }
  });

  // Exit Quiz option click
  exitBtn?.addEventListener("click", () => {
    if (dropdownContent) dropdownContent.style.display = "none";
    if (exitModal) exitModal.style.display = "flex";
  });

  // Cancel Exit
  cancelExitBtn?.addEventListener("click", () => {
    if (exitModal) exitModal.style.display = "none";
  });

  // Confirm Exit (clear sessionStorage and redirect)
  confirmExitBtn?.addEventListener("click", () => {
    if (timerInterval) clearInterval(timerInterval);
    sessionStorage.removeItem("shuffled_questions_" + quizId);
    sessionStorage.removeItem("draft_answers_" + quizId);
    sessionStorage.removeItem("timer_start_" + quizId);
    sessionStorage.removeItem("pwd_verified_" + quizId);
    window.location.href = "/browse.html";
  });
}

function initializeQuestions() {
  // Check if questions are already saved/shuffled in sessionStorage to prevent reshuffle on reload
  const savedQuestions = sessionStorage.getItem("shuffled_questions_" + quizId);
  
  if (savedQuestions) {
    shuffledQuestions = JSON.parse(savedQuestions);
  } else {
    // Shuffle the questions list using Fisher-Yates
    const questionsCopy = [...quiz.questions];
    const shuffledList = shuffleArray(questionsCopy);

    shuffledQuestions = shuffledList.map((q) => {
      let shuffledOpts = [];
      
      if (q.type === "tf") {
        shuffledOpts = ["True", "False"];
      } else {
        // Map original option texts with their original indices before shuffling
        const mappedOpts = q.options.map((optText, origIdx) => ({
          text: optText,
          originalIndex: origIdx
        }));
        shuffledOpts = shuffleArray(mappedOpts);
      }

      return {
        id: q.id,
        type: q.type,
        text: q.text,
        shuffledOptions: shuffledOpts,
        // Save mapping to identify which indices they represent in original order
        originalOptions: [...q.options]
      };
    });

    sessionStorage.setItem("shuffled_questions_" + quizId, JSON.stringify(shuffledQuestions));
  }
}

function restoreDraftAnswers() {
  const draft = sessionStorage.getItem("draft_answers_" + quizId);
  if (draft) {
    studentAnswers = JSON.parse(draft);
  }
}

function saveDraftAnswers() {
  sessionStorage.setItem("draft_answers_" + quizId, JSON.stringify(studentAnswers));
}

function initializeTimer() {
  if (quiz.timer && quiz.timer > 0) {
    const timerContainer = document.getElementById("timer-container");
    if (timerContainer) timerContainer.style.display = "flex";

    totalSeconds = quiz.timer * 60;
    
    // Check if there is an existing startTime recorded
    const startStr = sessionStorage.getItem("timer_start_" + quizId);
    if (startStr) {
      timerStart = parseInt(startStr);
      const elapsed = Math.floor((Date.now() - timerStart) / 1000);
      timeRemaining = totalSeconds - elapsed;
      
      if (timeRemaining <= 0) {
        // Time ran out while refreshed
        timeRemaining = 0;
        handleTimeOut();
        return;
      }
    } else {
      timerStart = Date.now();
      sessionStorage.setItem("timer_start_" + quizId, timerStart.toString());
      timeRemaining = totalSeconds;
    }

    updateTimerDisplay();
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timerStart) / 1000);
      timeRemaining = totalSeconds - elapsed;

      if (timeRemaining <= 0) {
        timeRemaining = 0;
        clearInterval(timerInterval);
        updateTimerDisplay();
        handleTimeOut();
      } else {
        updateTimerDisplay();
      }
    }, 1000);
  }
}

function updateTimerDisplay() {
  const display = document.getElementById("timer-display");
  const container = document.getElementById("timer-container");
  if (!display) return;

  const min = Math.floor(timeRemaining / 60).toString().padStart(2, "0");
  const sec = (timeRemaining % 60).toString().padStart(2, "0");
  display.textContent = `${min}:${sec}`;

  // Add flashing red class if <= 60 seconds (1 minute) left
  if (timeRemaining <= 60) {
    container?.classList.add("warning");
  } else {
    container?.classList.remove("warning");
  }
}

function renderQuestion() {
  const totalQs = shuffledQuestions.length;
  const q = shuffledQuestions[currentIdx];
  
  // Progress indicators
  document.getElementById("question-progress-label").textContent = `Question ${currentIdx + 1} of ${totalQs}`;
  const progressPercent = Math.round((currentIdx / totalQs) * 100);
  document.getElementById("progress-percentage").textContent = `${progressPercent}% Completed`;
  document.getElementById("progress-bar-indicator").style.width = `${(currentIdx / totalQs) * 100}%`;

  // Set question title
  document.getElementById("question-text-el").textContent = q.text;

  // Render choices
  const choicesContainer = document.getElementById("choices-list-el");
  if (!choicesContainer) return;
  choicesContainer.innerHTML = "";

  if (q.type === "mcq") {
    q.shuffledOptions.forEach((opt) => {
      const isSelected = studentAnswers[q.id] === opt.originalIndex;
      const choiceCard = document.createElement("div");
      choiceCard.className = `choice-item ${isSelected ? 'selected' : ''}`;
      
      choiceCard.innerHTML = `
        <div class="choice-circle"></div>
        <div class="choice-text">${escapeHtml(opt.text)}</div>
      `;

      choiceCard.addEventListener("click", () => {
        studentAnswers[q.id] = opt.originalIndex;
        saveDraftAnswers();
        renderQuestion(); // Re-render to update selected classes
      });

      choicesContainer.appendChild(choiceCard);
    });
  } else if (q.type === "tf") {
    q.shuffledOptions.forEach((opt) => {
      const isSelected = studentAnswers[q.id] === opt;
      const choiceCard = document.createElement("div");
      choiceCard.className = `choice-item ${isSelected ? 'selected' : ''}`;
      
      choiceCard.innerHTML = `
        <div class="choice-circle"></div>
        <div class="choice-text">${opt}</div>
      `;

      choiceCard.addEventListener("click", () => {
        studentAnswers[q.id] = opt;
        saveDraftAnswers();
        renderQuestion();
      });

      choicesContainer.appendChild(choiceCard);
    });
  } else if (q.type === "multi") {
    q.shuffledOptions.forEach((opt) => {
      const selectedList = studentAnswers[q.id] || [];
      const isSelected = selectedList.includes(opt.originalIndex);
      const choiceCard = document.createElement("div");
      choiceCard.className = `choice-item ${isSelected ? 'selected' : ''}`;
      
      choiceCard.innerHTML = `
        <div class="choice-square"></div>
        <div class="choice-text">${escapeHtml(opt.text)}</div>
      `;

      choiceCard.addEventListener("click", () => {
        let list = studentAnswers[q.id] || [];
        if (list.includes(opt.originalIndex)) {
          list = list.filter(idx => idx !== opt.originalIndex);
        } else {
          list.push(opt.originalIndex);
        }
        studentAnswers[q.id] = list;
        saveDraftAnswers();
        renderQuestion();
      });

      choicesContainer.appendChild(choiceCard);
    });
  }

  // Update navigation button states
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const submitBtn = document.getElementById("submit-btn");

  if (prevBtn) prevBtn.disabled = currentIdx === 0;

  if (currentIdx === totalQs - 1) {
    if (nextBtn) nextBtn.style.display = "none";
    if (submitBtn) submitBtn.style.display = "block";
  } else {
    if (nextBtn) nextBtn.style.display = "block";
    if (submitBtn) submitBtn.style.display = "none";
  }
}

function navigatePrevious() {
  if (currentIdx > 0) {
    currentIdx--;
    renderQuestion();
  }
}

function navigateNext() {
  if (currentIdx < shuffledQuestions.length - 1) {
    currentIdx++;
    renderQuestion();
  }
}

async function handleTimeOut() {
  showToast("Time is up! Submitting your answers automatically...", "warning");
  setTimeout(async () => {
    await submitQuiz(true);
  }, 1500);
}

async function handleSubmitAttempt() {
  // Count unanswered
  let unansweredCount = 0;
  shuffledQuestions.forEach((q) => {
    const ans = studentAnswers[q.id];
    if (ans === undefined || ans === "" || (Array.isArray(ans) && ans.length === 0)) {
      unansweredCount++;
    }
  });

  if (unansweredCount > 0) {
    if (!confirm(`Warning: You have ${unansweredCount} unanswered question(s). Are you sure you want to submit the quiz now?`)) {
      return;
    }
  } else {
    if (!confirm("Are you sure you want to submit your quiz? You cannot change your answers after submission.")) {
      return;
    }
  }

  await submitQuiz(false);
}

async function submitQuiz(isForced = false) {
  if (timerInterval) clearInterval(timerInterval);

  try {
    // 1. Calculate time spent
    let elapsedSeconds = 0;
    if (quiz.timer && quiz.timer > 0 && timerStart) {
      elapsedSeconds = Math.min(quiz.timer * 60, Math.floor((Date.now() - timerStart) / 1000));
    }

    // 2. Grade and compute results
    let correctCount = 0;
    const totalQuestions = quiz.questions.length;

    quiz.questions.forEach((q) => {
      const studentAns = studentAnswers[q.id];
      
      // Deobfuscate correct answer
      let correctVal;
      try {
        correctVal = JSON.parse(deobfuscate(q.correctAnswer));
      } catch (err) {
        correctVal = q.correctAnswer;
      }

      if (q.type === "mcq") {
        if (studentAns !== undefined && studentAns === correctVal) {
          correctCount++;
        }
      } else if (q.type === "tf") {
        if (studentAns !== undefined && studentAns === correctVal) {
          correctCount++;
        }
      } else if (q.type === "multi") {
        if (Array.isArray(studentAns) && Array.isArray(correctVal)) {
          // Compare checkbox arrays (sort before comparing strings)
          const sSorted = [...studentAns].sort().toString();
          const cSorted = [...correctVal].sort().toString();
          if (sSorted === cSorted) {
            correctCount++;
          }
        }
      }
    });

    const percentage = Math.round((correctCount / totalQuestions) * 100);
    
    // Grading
    let grade = "F";
    if (percentage >= 90) grade = "A";
    else if (percentage >= 75) grade = "B";
    else if (percentage >= 50) grade = "C";

    const attemptPayload = {
      quizId,
      quizTitle: quiz.title,
      studentId: activeStudent.uid,
      studentName: activeStudent.displayName || activeStudent.email,
      score: correctCount,
      totalQuestions,
      percentage,
      grade,
      answers: studentAnswers,
      timeSpent: elapsedSeconds
    };

    // Show loading submit spinner
    document.getElementById("attempt-main").style.display = "none";
    document.getElementById("attempt-loading").style.display = "flex";
    document.getElementById("attempt-loading").querySelector("p").textContent = "Submitting answers and grading attempt...";

    // Save to database
    const saved = await saveAttempt(attemptPayload);

    // Clear session storage values for this quiz
    sessionStorage.removeItem("shuffled_questions_" + quizId);
    sessionStorage.removeItem("draft_answers_" + quizId);
    sessionStorage.removeItem("timer_start_" + quizId);
    sessionStorage.removeItem("pwd_verified_" + quizId);

    showToast("Quiz submitted successfully!", "success");
    
    setTimeout(() => {
      window.location.href = `/result.html?attemptId=${saved.id}`;
    }, 1000);

  } catch (error) {
    console.error("Error submitting attempt:", error);
    showToast("Failed to submit quiz. Please retry.", "error");
    // Restore layout to let them retry
    document.getElementById("attempt-loading").style.display = "none";
    document.getElementById("attempt-main").style.display = "block";
  }
}

// Helpers
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
