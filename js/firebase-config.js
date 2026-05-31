import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./firebase-env.js";

let app = null;
let auth = null;
let db = null;
let isMock = false;

// Check if credentials are placeholders
if (
  !firebaseConfig ||
  firebaseConfig.apiKey.includes("YOUR_API_KEY") ||
  firebaseConfig.projectId.includes("YOUR_PROJECT_ID") ||
  !firebaseConfig.apiKey
) {
  console.warn("⚠️ Firebase configuration keys are placeholders. Falling back to LocalStorage Mock Mode.");
  isMock = true;
} else {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isMock = false;
    console.log("🔥 Firebase initialized successfully.");
  } catch (error) {
    console.error("❌ Failed to initialize Firebase SDK. Falling back to Mock Mode.", error);
    isMock = true;
  }
}

export { app, auth, db, isMock };
