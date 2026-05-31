import { isMock, auth, db } from "./firebase-config.js";
import { ADMIN_SECRET } from "./firebase-env.js";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

// Mock Authentication State
let authListeners = [];


// Seed default admin in mock mode if not present
if (isMock) {
  const users = JSON.parse(localStorage.getItem("mock_users") || "{}");
  if (!users["admin@quiz.com"]) {
    users["admin@quiz.com"] = {
      uid: "mock-admin-id",
      email: "admin@quiz.com",
      displayName: "Default Admin",
      role: "admin",
      password: "adminpassword", // In mock mode we store plain passwords for simplicity
      createdAt: new Date().toISOString()
    };
    localStorage.setItem("mock_users", JSON.stringify(users));
    console.log("🔑 Seeded Mock Admin account: admin@quiz.com / adminpassword");
  }
}

// Helper to notify mock listeners
function notifyMockListeners() {
  const user = getActiveUserSync();
  authListeners.forEach(callback => callback(user));
}

// Synchronous active user check for mock
function getActiveUserSync() {
  return JSON.parse(localStorage.getItem("mock_current_user") || "null");
}

// ----------------------------------------------------
// Public Authentication API
// ----------------------------------------------------

/**
 * Registers a student.
 */
export async function signUpStudent(email, password, displayName) {
  if (isMock) {
    const usersMap = new Map(Object.entries(JSON.parse(localStorage.getItem("mock_users") || "{}")));
    const key = email.toLowerCase();
    if (usersMap.has(key)) {
      throw new Error("Email already registered.");
    }
    const uid = "student-" + Math.random().toString(36).substr(2, 9);
    const newUser = {
      uid,
      email: key,
      displayName,
      role: "student",
      password,
      createdAt: new Date().toISOString()
    };
    usersMap.set(key, newUser);
    localStorage.setItem("mock_users", JSON.stringify(Object.fromEntries(usersMap)));
    localStorage.setItem("mock_current_user", JSON.stringify(newUser));
    notifyMockListeners();
    return newUser;
  } else {
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Store in Firestore
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: email.toLowerCase(),
      displayName: displayName,
      role: "student",
      createdAt: serverTimestamp()
    });
    
    return user;
  }
}

/**
 * Registers an admin (using a secret code).
 */
export async function signUpAdmin(email, password, displayName, secretCode) {
  if (secretCode !== ADMIN_SECRET) {
    throw new Error("Invalid admin registration secret code.");
  }

  if (isMock) {
    const usersMap = new Map(Object.entries(JSON.parse(localStorage.getItem("mock_users") || "{}")));
    const key = email.toLowerCase();
    if (usersMap.has(key)) {
      throw new Error("Email already registered.");
    }
    const uid = "admin-" + Math.random().toString(36).substr(2, 9);
    const newUser = {
      uid,
      email: key,
      displayName,
      role: "admin",
      password,
      createdAt: new Date().toISOString()
    };
    usersMap.set(key, newUser);
    localStorage.setItem("mock_users", JSON.stringify(Object.fromEntries(usersMap)));
    localStorage.setItem("mock_current_user", JSON.stringify(newUser));
    notifyMockListeners();
    return newUser;
  } else {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: email.toLowerCase(),
      displayName: displayName,
      role: "admin",
      createdAt: serverTimestamp()
    });
    
    return user;
  }
}

/**
 * Log in a user (student or admin).
 */
export async function loginUser(email, password, expectedRole = "student") {
  if (isMock) {
    const usersMap = new Map(Object.entries(JSON.parse(localStorage.getItem("mock_users") || "{}")));
    const key = email.toLowerCase();
    const user = usersMap.get(key);
    if (!user || user.password !== password) {
      throw new Error("Invalid email or password.");
    }
    if (user.role !== expectedRole) {
      throw new Error(`Unauthorized. This login is only for ${expectedRole}s.`);
    }
    localStorage.setItem("mock_current_user", JSON.stringify(user));
    notifyMockListeners();
    return user;
  } else {
    // Sign in Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Retrieve Firestore user profile
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
      await signOut(auth);
      throw new Error("User profile not found.");
    }
    
    const userData = userDoc.data();
    if (userData.role !== expectedRole) {
      await signOut(auth);
      throw new Error(`Unauthorized. This login is only for ${expectedRole}s.`);
    }
    
    return {
      uid: user.uid,
      email: user.email,
      displayName: userData.displayName,
      role: userData.role
    };
  }
}

/**
 * Log out current user.
 */
export async function logoutUser() {
  if (isMock) {
    localStorage.removeItem("mock_current_user");
    notifyMockListeners();
    return true;
  } else {
    await signOut(auth);
    return true;
  }
}

/**
 * Listens to authentication state changes.
 */
export function onAuthChanged(callback) {
  if (isMock) {
    authListeners.push(callback);
    // Call immediately with current state
    const user = getActiveUserSync();
    callback(user);
    // Return unsubscribe function
    return () => {
      authListeners = authListeners.filter(listener => listener !== callback);
    };
  } else {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            callback({
              uid: user.uid,
              email: user.email,
              displayName: userData.displayName || user.displayName || user.email.split('@')[0],
              role: userData.role
            });
          } else {
            callback({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || user.email.split('@')[0],
              role: "student"
            });
          }
        } catch (e) {
          console.error("Error loading user profile:", e);
          callback(null);
        }
      } else {
        callback(null);
      }
    });
  }
}

/**
 * Guard routes by checking auth state and role.
 * Redirects to appropriate page if unauthorized.
 */
export function protectRoute(allowedRole = null) {
  return new Promise((resolve) => {
    const unsubscribe = onAuthChanged((user) => {
      unsubscribe(); // Run once
      
      const currentPage = window.location.pathname.split("/").pop() || "index.html";
      
      // If user is not logged in
      if (!user) {
        if (allowedRole) {
          // If accessing protected page, redirect to appropriate login page
          if (allowedRole === "admin") {
            window.location.href = "/admin-login.html";
          } else {
            window.location.href = "/login.html";
          }
        } else {
          resolve(null);
        }
        return;
      }
      
      // If user is logged in but role is unauthorized
      if (allowedRole && user.role !== allowedRole) {
        if (allowedRole === "admin") {
          window.location.href = "/admin-login.html";
        } else {
          window.location.href = "/login.html";
        }
        return;
      }
      
      // If logged-in user tries to visit Landing/Login/Register pages
      if (!allowedRole) {
        if (currentPage === "index.html") {
          if (user.role === "admin") {
            window.location.href = "/admin-dashboard.html";
          } else {
            window.location.href = "/browse.html";
          }
          return;
        }

        if (user.role === "student" && ["login.html", "register.html"].includes(currentPage)) {
          window.location.href = "/browse.html";
          return;
        }

        if (user.role === "admin" && ["admin-login.html", "login.html", "register.html"].includes(currentPage)) {
          window.location.href = "/admin-dashboard.html";
          return;
        }
      }
      
      resolve(user);
    });
  });
}

/**
 * Shared Dynamic Navbar Manager
 */
export function initNavbar() {
  const navbarLinks = document.getElementById("navbar-links");
  if (!navbarLinks) return;

  onAuthChanged((user) => {
    navbarLinks.innerHTML = "";

    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    const isActive = (page) => currentPage === page ? "nav-link active" : "nav-link";

    // Home Link
    const homeLi = document.createElement("li");
    const homeA = document.createElement("a");
    homeA.href = "/index.html";
    homeA.className = isActive("index.html");
    homeA.textContent = "Home";
    homeLi.appendChild(homeA);
    navbarLinks.appendChild(homeLi);

    if (user) {
      if (user.role === "admin") {
        // Dashboard Link
        const dashLi = document.createElement("li");
        const dashA = document.createElement("a");
        dashA.href = "/admin-dashboard.html";
        dashA.className = isActive("admin-dashboard.html");
        dashA.textContent = "Dashboard";
        dashLi.appendChild(dashA);
        navbarLinks.appendChild(dashLi);

        // Create Quiz Link
        const createLi = document.createElement("li");
        const createA = document.createElement("a");
        createA.href = "/quiz-creator.html";
        createA.className = isActive("quiz-creator.html");
        createA.textContent = "Create Quiz";
        createLi.appendChild(createA);
        navbarLinks.appendChild(createLi);

        // Admin Info Span
        const infoLi = document.createElement("li");
        const infoSpan = document.createElement("span");
        infoSpan.className = "nav-link";
        infoSpan.style.color = "var(--text-primary)";
        infoSpan.style.cursor = "default";
        infoSpan.textContent = `Admin: ${user.displayName || user.email}`;
        infoLi.appendChild(infoSpan);
        navbarLinks.appendChild(infoLi);
      } else {
        // Browse Quizzes Link
        const browseLi = document.createElement("li");
        const browseA = document.createElement("a");
        browseA.href = "/browse.html";
        browseA.className = isActive("browse.html");
        browseA.textContent = "Browse Quizzes";
        browseLi.appendChild(browseA);
        navbarLinks.appendChild(browseLi);

        // Profile Link
        const profileLi = document.createElement("li");
        const profileA = document.createElement("a");
        profileA.href = "/profile.html";
        profileA.className = isActive("profile.html");
        profileA.textContent = "My Profile";
        profileLi.appendChild(profileA);
        navbarLinks.appendChild(profileLi);

        // Student Info Span
        const infoLi = document.createElement("li");
        const infoSpan = document.createElement("span");
        infoSpan.className = "nav-link";
        infoSpan.style.color = "var(--text-primary)";
        infoSpan.style.cursor = "default";
        infoSpan.textContent = `Hi, ${user.displayName}`;
        infoLi.appendChild(infoSpan);
        navbarLinks.appendChild(infoLi);
      }

      // Logout Button
      const logoutLi = document.createElement("li");
      const logoutBtn = document.createElement("button");
      logoutBtn.className = "btn btn-sm btn-secondary";
      logoutBtn.id = "logout-btn";
      logoutBtn.textContent = "Logout";
      logoutLi.appendChild(logoutBtn);
      navbarLinks.appendChild(logoutLi);

      logoutBtn.addEventListener("click", async () => {
        try {
          const userRole = user.role;
          await logoutUser();
          if (userRole === "admin") {
            window.location.href = "/admin-login.html";
          } else {
            window.location.href = "/login.html";
          }
        } catch (error) {
          import("./utils.js").then((m) => m.showToast(error.message, "error"));
        }
      });
    } else {
      // Browse Quizzes Link
      const browseLi = document.createElement("li");
      const browseA = document.createElement("a");
      browseA.href = "/browse.html";
      browseA.className = isActive("browse.html");
      browseA.textContent = "Browse Quizzes";
      browseLi.appendChild(browseA);
      navbarLinks.appendChild(browseLi);

      // Student Login Link
      const loginLi = document.createElement("li");
      const loginA = document.createElement("a");
      loginA.href = "/login.html";
      loginA.className = isActive("login.html");
      loginA.textContent = "Student Login";
      loginLi.appendChild(loginA);
      navbarLinks.appendChild(loginLi);

      // Admin Login Link
      const adminLi = document.createElement("li");
      const adminA = document.createElement("a");
      adminA.href = "/admin-login.html";
      adminA.className = isActive("admin-login.html");
      adminA.textContent = "Admin Portal";
      adminLi.appendChild(adminA);
      navbarLinks.appendChild(adminLi);
    }
  });
}
