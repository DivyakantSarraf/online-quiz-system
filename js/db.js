import { isMock, db } from "./firebase-config.js";
import { 
  collection, 
  addDoc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc, 
  doc,
  serverTimestamp 
} from "firebase/firestore";

// Helper to generate IDs in mock mode
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// ----------------------------------------------------
// Quiz Operations
// ----------------------------------------------------

export async function saveQuiz(quizData, quizId = null) {
  if (isMock) {
    const quizzes = JSON.parse(localStorage.getItem("mock_quizzes") || "{}");
    const id = quizId || "quiz-" + generateId();
    const newQuiz = {
      ...quizData,
      id,
      createdAt: quizData.createdAt || new Date().toISOString()
    };
    quizzes[id] = newQuiz;
    localStorage.setItem("mock_quizzes", JSON.stringify(quizzes));
    return newQuiz;
  } else {
    const quizRef = quizId ? doc(db, "quizzes", quizId) : doc(collection(db, "quizzes"));
    const finalData = {
      ...quizData,
      id: quizRef.id,
      createdAt: quizData.createdAt || serverTimestamp()
    };
    await setDoc(quizRef, finalData);
    return finalData;
  }
}

export async function getQuiz(quizId) {
  if (isMock) {
    const quizzes = JSON.parse(localStorage.getItem("mock_quizzes") || "{}");
    const quiz = quizzes[quizId];
    if (!quiz) throw new Error("Quiz not found.");
    return quiz;
  } else {
    const docRef = doc(db, "quizzes", quizId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Quiz not found.");
    return docSnap.data();
  }
}

export async function deleteQuiz(quizId) {
  if (isMock) {
    const quizzes = JSON.parse(localStorage.getItem("mock_quizzes") || "{}");
    if (!quizzes[quizId]) throw new Error("Quiz not found.");
    delete quizzes[quizId];
    localStorage.setItem("mock_quizzes", JSON.stringify(quizzes));
    return true;
  } else {
    const docRef = doc(db, "quizzes", quizId);
    await deleteDoc(docRef);
    return true;
  }
}

export async function getQuizzesByAdmin(adminUid) {
  if (isMock) {
    const quizzes = JSON.parse(localStorage.getItem("mock_quizzes") || "{}");
    return Object.values(quizzes).filter(q => q.createdBy === adminUid);
  } else {
    const q = query(collection(db, "quizzes"), where("createdBy", "==", adminUid));
    const querySnapshot = await getDocs(q);
    const results = [];
    querySnapshot.forEach(doc => {
      results.push(doc.data());
    });
    return results;
  }
}

export async function getAllPublishedQuizzes() {
  if (isMock) {
    const quizzes = JSON.parse(localStorage.getItem("mock_quizzes") || "{}");
    return Object.values(quizzes).filter(q => q.isPublished === true);
  } else {
    const q = query(collection(db, "quizzes"), where("isPublished", "==", true));
    const querySnapshot = await getDocs(q);
    const results = [];
    querySnapshot.forEach(doc => {
      results.push(doc.data());
    });
    return results;
  }
}

// ----------------------------------------------------
// Attempt Operations
// ----------------------------------------------------

export async function saveAttempt(attemptData) {
  if (isMock) {
    const attempts = JSON.parse(localStorage.getItem("mock_attempts") || "{}");
    const id = "attempt-" + generateId();
    const newAttempt = {
      ...attemptData,
      id,
      timestamp: new Date().toISOString()
    };
    attempts[id] = newAttempt;
    localStorage.setItem("mock_attempts", JSON.stringify(attempts));
    return newAttempt;
  } else {
    const attemptsRef = collection(db, "attempts");
    const finalData = {
      ...attemptData,
      timestamp: serverTimestamp()
    };
    const docRef = await addDoc(attemptsRef, finalData);
    await setDoc(docRef, { ...finalData, id: docRef.id });
    return { ...finalData, id: docRef.id };
  }
}

export async function getAttempt(attemptId) {
  if (isMock) {
    const attempts = JSON.parse(localStorage.getItem("mock_attempts") || "{}");
    const attempt = attempts[attemptId];
    if (!attempt) throw new Error("Attempt not found.");
    return attempt;
  } else {
    const docRef = doc(db, "attempts", attemptId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Attempt not found.");
    return docSnap.data();
  }
}

export async function getAttemptsByStudent(studentUid) {
  if (isMock) {
    const attempts = JSON.parse(localStorage.getItem("mock_attempts") || "{}");
    return Object.values(attempts)
      .filter(a => a.studentId === studentUid)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } else {
    const q = query(
      collection(db, "attempts"), 
      where("studentId", "==", studentUid),
      orderBy("timestamp", "desc")
    );
    const querySnapshot = await getDocs(q);
    const results = [];
    querySnapshot.forEach(doc => {
      results.push(doc.data());
    });
    return results;
  }
}

export async function getAttemptsByAdmin(adminUid) {
  if (isMock) {
    const attempts = JSON.parse(localStorage.getItem("mock_attempts") || "{}");
    const quizzes = JSON.parse(localStorage.getItem("mock_quizzes") || "{}");
    const adminQuizIds = Object.values(quizzes)
      .filter(q => q.createdBy === adminUid)
      .map(q => q.id);
    return Object.values(attempts)
      .filter(a => adminQuizIds.includes(a.quizId))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } else {
    // In Firebase client-side without complex indexing, we'll query all attempts and filter
    const querySnapshot = await getDocs(collection(db, "attempts"));
    const adminQuizzes = await getQuizzesByAdmin(adminUid);
    const adminQuizIds = adminQuizzes.map(q => q.id);
    const results = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      if (adminQuizIds.includes(data.quizId)) {
        results.push(data);
      }
    });
    return results.sort((a, b) => {
      const tA = a.timestamp?.seconds || 0;
      const tB = b.timestamp?.seconds || 0;
      return tB - tA;
    });
  }
}

export async function getLeaderboard(quizId) {
  if (isMock) {
    const attempts = JSON.parse(localStorage.getItem("mock_attempts") || "{}");
    return Object.values(attempts)
      .filter(a => a.quizId === quizId)
      .sort((a, b) => b.percentage - a.percentage || a.timeSpent - b.timeSpent);
  } else {
    const q = query(
      collection(db, "attempts"), 
      where("quizId", "==", quizId),
      orderBy("percentage", "desc")
    );
    const querySnapshot = await getDocs(q);
    const results = [];
    querySnapshot.forEach(doc => {
      results.push(doc.data());
    });
    // In-memory tie-breaker by timeSpent since Firestore multi-field sort requires composite index creation
    return results.sort((a, b) => b.percentage - a.percentage || (a.timeSpent || 0) - (b.timeSpent || 0));
  }
}
