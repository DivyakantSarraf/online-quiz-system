import { protectRoute, initNavbar } from "../auth.js";
import { isMock } from "../firebase-config.js";
import { injectMockNotice, showToast, obfuscate, deobfuscate } from "../utils.js";
import { saveQuiz, getQuiz } from "../db.js";

// Page state
let adminUser = null;
let editQuizId = null;
let questions = [];

document.addEventListener("DOMContentLoaded", async () => {
  // Inject mock warning banner if mock mode
  injectMockNotice(isMock);

  // Protect route: requires 'admin' role
  adminUser = await protectRoute("admin");
  if (!adminUser) return;

  // Initialize navbar
  initNavbar();

  // Check if editing an existing quiz
  const urlParams = new URLSearchParams(window.location.search);
  editQuizId = urlParams.get("editId");

  if (editQuizId) {
    document.getElementById("creator-page-title").textContent = "Edit Quiz";
    document.getElementById("save-quiz-btn").textContent = "⚡ Update Quiz Changes";
    await loadQuizForEdit(editQuizId);
  }

  // Event Listeners for category change
  const categorySelect = document.getElementById("quiz-category");
  const categoryCustomInput = document.getElementById("quiz-category-custom");

  if (categorySelect && categoryCustomInput) {
    categorySelect.addEventListener("change", () => {
      if (categorySelect.value === "custom") {
        categoryCustomInput.style.display = "block";
        categoryCustomInput.required = true;
      } else {
        categoryCustomInput.style.display = "none";
        categoryCustomInput.required = false;
        categoryCustomInput.value = "";
      }
    });
  }

  // Question adding button triggers
  document.getElementById("add-mcq-btn")?.addEventListener("click", () => addQuestion("mcq"));
  document.getElementById("add-tf-btn")?.addEventListener("click", () => addQuestion("tf"));
  document.getElementById("add-multi-btn")?.addEventListener("click", () => addQuestion("multi"));

  // Settings form submissions
  const settingsForm = document.getElementById("quiz-settings-form");
  if (settingsForm) {
    settingsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleSaveQuiz();
    });
  }
});

// Load quiz to edit
async function loadQuizForEdit(quizId) {
  try {
    const quiz = await getQuiz(quizId);
    
    // Fill basic details
    document.getElementById("quiz-title").value = quiz.title;
    document.getElementById("quiz-description").value = quiz.description;
    
    const categorySelect = document.getElementById("quiz-category");
    const categoryCustomInput = document.getElementById("quiz-category-custom");
    
    if (["Maths", "Science", "English", "Computer", "History"].includes(quiz.category)) {
      categorySelect.value = quiz.category;
    } else {
      categorySelect.value = "custom";
      categoryCustomInput.style.display = "block";
      categoryCustomInput.required = true;
      categoryCustomInput.value = quiz.category;
    }
    
    document.getElementById("quiz-difficulty").value = quiz.difficulty;
    document.getElementById("quiz-timer").value = quiz.timer;
    document.getElementById("quiz-max-attempts").value = quiz.maxAttempts !== undefined && quiz.maxAttempts !== null ? quiz.maxAttempts : "";
    document.getElementById("quiz-password").value = quiz.password || "";
    document.getElementById("quiz-published").checked = quiz.isPublished;

    // Load questions (need to de-obfuscate or keep obfuscated correctAnswer since we will obfuscate on save again)
    // Actually, when loading for edit, we should de-obfuscate answers so the creator displays the checked boxes correctly
    questions = quiz.questions.map((q) => {
      let rawCorrect;
      try {
        rawCorrect = JSON.parse(deobfuscate(q.correctAnswer));
      } catch (e) {
        rawCorrect = q.correctAnswer; // Fail-safe
      }
      return {
        id: q.id,
        type: q.type,
        text: q.text,
        options: [...q.options],
        correctAnswer: rawCorrect
      };
    });

    renderQuestions();
  } catch (error) {
    console.error("Error loading quiz for edit:", error);
    showToast("Failed to load quiz details: " + error.message, "error");
  }
}

// Add a new question template
function addQuestion(type) {
  const id = "q-" + Math.random().toString(36).substr(2, 9);
  let newQ;

  if (type === "mcq") {
    newQ = {
      id,
      type: "mcq",
      text: "",
      options: ["", "", "", ""],
      correctAnswer: 0 // Index of correct option
    };
  } else if (type === "tf") {
    newQ = {
      id,
      type: "tf",
      text: "",
      options: ["True", "False"],
      correctAnswer: "True" // String answer
    };
  } else if (type === "multi") {
    newQ = {
      id,
      type: "multi",
      text: "",
      options: ["", "", "", ""],
      correctAnswer: [] // Array of indices
    };
  }

  questions.push(newQ);
  renderQuestions();
  
  // Smooth scroll to the bottom of the card list
  const container = document.getElementById("questions-container");
  if (container) {
    container.lastElementChild?.scrollIntoView({ behavior: "smooth" });
  }
}

// Render dynamic questions builder cards
function renderQuestions() {
  const container = document.getElementById("questions-container");
  const countSpan = document.getElementById("question-count");
  if (!container) return;

  if (countSpan) countSpan.textContent = questions.length;

  if (questions.length === 0) {
    container.innerHTML = `
      <div class="empty-placeholder" id="no-questions-placeholder">
        <span>📝</span>
        <p>Click one of the buttons above to add your first question.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = "";

  questions.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "question-builder-card";
    card.id = `q-card-${q.id}`;
    
    // Add relative count
    const numLabel = document.createElement("div");
    numLabel.className = "question-card-number";
    numLabel.textContent = `#${idx + 1}`;
    card.appendChild(numLabel);

    // Textarea question title
    const groupText = document.createElement("div");
    groupText.className = "form-group";
    groupText.innerHTML = `
      <label class="form-label">Question Text (${q.type.toUpperCase()})</label>
      <textarea class="form-control q-text-input" rows="2" placeholder="Type question here..." required>${escapeHtml(q.text)}</textarea>
    `;
    card.appendChild(groupText);

    // Bind question text change
    groupText.querySelector("textarea").addEventListener("input", (e) => {
      q.text = e.target.value;
    });

    // Options container
    const optionsWrapper = document.createElement("div");
    optionsWrapper.className = "options-builder";
    
    if (q.type === "mcq") {
      q.options.forEach((opt, oIdx) => {
        const optionRow = document.createElement("div");
        optionRow.className = "option-row";
        
        const isChecked = q.correctAnswer === oIdx ? "checked" : "";
        
        optionRow.innerHTML = `
          <label class="option-indicator">
            <input type="radio" name="correct-${q.id}" class="mcq-correct" data-idx="${oIdx}" ${isChecked}>
            <span class="indicator-box indicator-radio"></span>
          </label>
          <input type="text" class="form-control option-text" value="${escapeHtml(opt)}" placeholder="Option ${oIdx + 1}" required style="margin-bottom:0;">
        `;

        // Bind radio change
        optionRow.querySelector("input[type='radio']").addEventListener("change", () => {
          q.correctAnswer = oIdx;
        });

        // Bind text change
        optionRow.querySelector("input[type='text']").addEventListener("input", (e) => {
          q.options[oIdx] = e.target.value;
        });

        optionsWrapper.appendChild(optionRow);
      });
    } else if (q.type === "tf") {
      // Options are fixed to True and False
      ["True", "False"].forEach((opt) => {
        const optionRow = document.createElement("div");
        optionRow.className = "option-row";
        
        const isChecked = q.correctAnswer === opt ? "checked" : "";
        
        optionRow.innerHTML = `
          <label class="option-indicator">
            <input type="radio" name="correct-${q.id}" class="tf-correct" value="${opt}" ${isChecked}>
            <span class="indicator-box indicator-radio"></span>
          </label>
          <div style="font-weight: 500; font-size: 0.95rem; color: var(--text-primary); margin-left: 0.25rem;">${opt}</div>
        `;

        optionRow.querySelector("input[type='radio']").addEventListener("change", () => {
          q.correctAnswer = opt;
        });

        optionsWrapper.appendChild(optionRow);
      });
    } else if (q.type === "multi") {
      q.options.forEach((opt, oIdx) => {
        const optionRow = document.createElement("div");
        optionRow.className = "option-row";
        
        const isChecked = Array.isArray(q.correctAnswer) && q.correctAnswer.includes(oIdx) ? "checked" : "";

        optionRow.innerHTML = `
          <label class="option-indicator">
            <input type="checkbox" class="multi-correct" data-idx="${oIdx}" ${isChecked}>
            <span class="indicator-box"></span>
          </label>
          <input type="text" class="form-control option-text" value="${escapeHtml(opt)}" placeholder="Option ${oIdx + 1}" required style="margin-bottom:0;">
        `;

        // Bind checkbox change
        optionRow.querySelector("input[type='checkbox']").addEventListener("change", (e) => {
          if (e.target.checked) {
            if (!q.correctAnswer.includes(oIdx)) q.correctAnswer.push(oIdx);
          } else {
            q.correctAnswer = q.correctAnswer.filter(item => item !== oIdx);
          }
        });

        // Bind text change
        optionRow.querySelector("input[type='text']").addEventListener("input", (e) => {
          q.options[oIdx] = e.target.value;
        });

        optionsWrapper.appendChild(optionRow);
      });
    }

    card.appendChild(optionsWrapper);

    // Delete question action row
    const actionRow = document.createElement("div");
    actionRow.className = "question-actions-row";
    actionRow.innerHTML = `
      <button type="button" class="btn btn-outline btn-xs btn-delete-q" style="color: var(--color-danger); border-color: rgba(239, 68, 68, 0.2);">🗑️ Remove Question</button>
    `;
    
    actionRow.querySelector(".btn-delete-q").addEventListener("click", () => {
      questions.splice(idx, 1);
      renderQuestions();
    });

    card.appendChild(actionRow);
    container.appendChild(card);
  });
}

// Handle save/publish quiz
async function handleSaveQuiz() {
  const title = document.getElementById("quiz-title").value.trim();
  const description = document.getElementById("quiz-description").value.trim();
  
  const categorySelect = document.getElementById("quiz-category");
  let category = categorySelect.value;
  if (category === "custom") {
    category = document.getElementById("quiz-category-custom").value.trim();
  }

  const difficulty = document.getElementById("quiz-difficulty").value;
  const timer = parseInt(document.getElementById("quiz-timer").value) || 0;
  const maxAttemptsVal = document.getElementById("quiz-max-attempts").value;
  const maxAttempts = maxAttemptsVal !== "" ? parseInt(maxAttemptsVal) || null : null;
  const password = document.getElementById("quiz-password").value.trim();
  const isPublished = document.getElementById("quiz-published").checked;

  // Validation settings
  if (!title || !description || !category) {
    showToast("Quiz title, description, and category are required.", "error");
    return;
  }

  // Question validation
  if (questions.length === 0) {
    showToast("Please add at least one question to the quiz.", "error");
    return;
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.text.trim()) {
      showToast(`Question #${i + 1} text is empty.`, "error");
      return;
    }

    if (q.type === "mcq" || q.type === "multi") {
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].trim()) {
          showToast(`Option ${j + 1} in Question #${i + 1} is empty.`, "error");
          return;
        }
      }
    }

    if (q.type === "multi" && (!Array.isArray(q.correctAnswer) || q.correctAnswer.length === 0)) {
      showToast(`Please check at least one correct option for Multiple-Correct Question #${i + 1}.`, "error");
      return;
    }
  }

  // Obfuscate correct answers for storage
  const finalQuestions = questions.map((q) => {
    // Obfuscate the correctAnswer using Base64
    const obfuscatedCorrect = obfuscate(JSON.stringify(q.correctAnswer));
    return {
      id: q.id,
      type: q.type,
      text: q.text.trim(),
      options: q.options.map(o => o.trim()),
      correctAnswer: obfuscatedCorrect
    };
  });

  const quizPayload = {
    title,
    description,
    category,
    difficulty,
    timer,
    maxAttempts,
    password,
    isPublished,
    questions: finalQuestions,
    createdBy: adminUser.uid
  };

  try {
    const btn = document.getElementById("save-quiz-btn");
    btn.disabled = true;
    btn.textContent = "Saving Quiz...";

    await saveQuiz(quizPayload, editQuizId);
    showToast(editQuizId ? "Quiz updated successfully!" : "Quiz created and published!", "success");

    setTimeout(() => {
      window.location.href = "/admin-dashboard.html";
    }, 1200);
  } catch (error) {
    console.error("Error saving quiz:", error);
    showToast("Error saving quiz: " + error.message, "error");
    const btn = document.getElementById("save-quiz-btn");
    btn.disabled = false;
    btn.textContent = editQuizId ? "⚡ Update Quiz Changes" : "⚡ Save and Publish Quiz";
  }
}

// Helpers
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
