import { protectRoute, signUpStudent, signUpAdmin, loginUser, initNavbar } from "../auth.js";
import { isMock } from "../firebase-config.js";
import { injectMockNotice, showToast } from "../utils.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Inject mock warning banner if offline mode
  injectMockNotice(isMock);

  // Protect route: redirects logged-in users away from login/register pages
  await protectRoute(null);

  // Initialize navbar links
  initNavbar();

  const authAlert = document.getElementById("auth-alert");

  // Helper to show errors
  function showError(msg) {
    if (!authAlert) return;
    authAlert.textContent = msg;
    authAlert.className = "alert alert-danger";
    authAlert.style.display = "block";
    authAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Helper to clear errors
  function clearError() {
    if (!authAlert) return;
    authAlert.style.display = "none";
    authAlert.textContent = "";
  }

  // ----------------------------------------------------
  // Admin Login/Register Tab Toggle
  // ----------------------------------------------------
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const loginView = document.getElementById("admin-login-view");
  const registerView = document.getElementById("admin-register-view");

  if (tabLogin && tabRegister && loginView && registerView) {
    const tabs = [tabLogin, tabRegister];
    const views = [loginView, registerView];

    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        // Remove active class from all tabs
        tabs.forEach(t => t.classList.remove("active"));
        // Add active to clicked tab
        tab.classList.add("active");

        // Hide all views
        views.forEach(v => v.style.display = "none");
        // Show target view
        const targetId = tab.getAttribute("data-target");
        document.getElementById(targetId).style.display = "block";
        
        clearError();
      });
    });
  }

  // ----------------------------------------------------
  // Form Submit: Student Registration
  // ----------------------------------------------------
  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearError();

      const name = document.getElementById("reg-name").value.trim();
      const email = document.getElementById("reg-email").value.trim();
      const password = document.getElementById("reg-password").value;
      const confirmPassword = document.getElementById("reg-confirm-password").value;

      // Validation
      if (!name || !email || !password || !confirmPassword) {
        showError("All fields are required.");
        return;
      }
      if (password.length < 6) {
        showError("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        showError("Passwords do not match.");
        return;
      }

      try {
        const btn = registerForm.querySelector("button[type='submit']");
        btn.disabled = true;
        btn.textContent = "Creating Account...";
        
        await signUpStudent(email, password, name);
        showToast("Registration successful! Redirecting...", "success");
        setTimeout(() => {
          window.location.href = "/browse.html";
        }, 1000);
      } catch (err) {
        showError(err.message || "Failed to create account.");
        const btn = registerForm.querySelector("button[type='submit']");
        btn.disabled = false;
        btn.textContent = "Create Student Account";
      }
    });
  }

  // ----------------------------------------------------
  // Form Submit: Student Login
  // ----------------------------------------------------
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearError();

      const email = document.getElementById("log-email").value.trim();
      const password = document.getElementById("log-password").value;

      if (!email || !password) {
        showError("All fields are required.");
        return;
      }

      try {
        const btn = loginForm.querySelector("button[type='submit']");
        btn.disabled = true;
        btn.textContent = "Logging In...";
        
        await loginUser(email, password, "student");
        showToast("Login successful! Redirecting...", "success");
        setTimeout(() => {
          window.location.href = "/browse.html";
        }, 1000);
      } catch (err) {
        showError(err.message || "Login failed. Please check credentials.");
        const btn = loginForm.querySelector("button[type='submit']");
        btn.disabled = false;
        btn.textContent = "Log In as Student";
      }
    });
  }

  // ----------------------------------------------------
  // Form Submit: Admin Login
  // ----------------------------------------------------
  const adminLoginForm = document.getElementById("admin-login-form");
  if (adminLoginForm) {
    adminLoginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearError();

      const email = document.getElementById("admin-log-email").value.trim();
      const password = document.getElementById("admin-log-password").value;

      if (!email || !password) {
        showError("All fields are required.");
        return;
      }

      try {
        const btn = adminLoginForm.querySelector("button[type='submit']");
        btn.disabled = true;
        btn.textContent = "Logging In...";

        await loginUser(email, password, "admin");
        showToast("Admin login successful! Redirecting...", "success");
        setTimeout(() => {
          window.location.href = "/admin-dashboard.html";
        }, 1000);
      } catch (err) {
        showError(err.message || "Admin login failed.");
        const btn = adminLoginForm.querySelector("button[type='submit']");
        btn.disabled = false;
        btn.textContent = "Log In as Admin";
      }
    });
  }

  // ----------------------------------------------------
  // Form Submit: Admin Registration
  // ----------------------------------------------------
  const adminRegisterForm = document.getElementById("admin-register-form");
  if (adminRegisterForm) {
    adminRegisterForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearError();

      const name = document.getElementById("admin-reg-name").value.trim();
      const email = document.getElementById("admin-reg-email").value.trim();
      const password = document.getElementById("admin-reg-password").value;
      const confirmPassword = document.getElementById("admin-reg-confirm").value;
      const secretCode = document.getElementById("admin-reg-key").value.trim();

      if (!name || !email || !password || !confirmPassword || !secretCode) {
        showError("All fields are required.");
        return;
      }
      if (password.length < 6) {
        showError("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        showError("Passwords do not match.");
        return;
      }

      try {
        const btn = adminRegisterForm.querySelector("button[type='submit']");
        btn.disabled = true;
        btn.textContent = "Registering Admin...";

        await signUpAdmin(email, password, name, secretCode);
        showToast("Admin registered successfully! Redirecting...", "success");
        setTimeout(() => {
          window.location.href = "/admin-dashboard.html";
        }, 1000);
      } catch (err) {
        showError(err.message || "Admin registration failed.");
        const btn = adminRegisterForm.querySelector("button[type='submit']");
        btn.disabled = false;
        btn.textContent = "Register Admin Account";
      }
    });
  }
});
