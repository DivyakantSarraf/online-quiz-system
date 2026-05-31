# 📝 Online Quiz System

A full-stack web application for creating, managing, and taking online quizzes — built with vanilla HTML, CSS, and JavaScript, powered by Firebase (Auth + Firestore).

---

## ✨ Features

### 👨‍🏫 Admin
- Secure admin login (separate from student login)
- Create quizzes with multiple-choice questions
- Set time limits per quiz (in minutes)
- Set max attempt limits per quiz (or allow unlimited)
- View all quizzes and delete them
- View all recent student attempts across all quizzes

### 🎓 Student
- Register and log in as a student
- Browse all available quizzes with remaining attempts shown
- Take timed quizzes with auto-submit on timeout
- View instant results with score, percentage, grade, and pass/fail
- View per-question feedback (correct / incorrect / skipped)
- View attempt history and personal stats on profile page

### 🏆 Leaderboard
- Per-quiz leaderboard accessible after completing a quiz
- Podium display for top 3 students (🥇 🥈 🥉)
- Full ranked table for remaining students
- De-duplicated: only best attempt per student is shown

---

## 🗂️ Project Structure

```
online-quiz-system/
│
├── index.html              # Landing page
├── login.html              # Student login
├── register.html           # Student registration
├── admin-login.html        # Admin login
├── admin-dashboard.html    # Admin dashboard
├── browse.html             # Quiz browser (students)
├── quiz-creator.html       # Quiz creation form (admin)
├── attempt.html            # Quiz attempt page
├── result.html             # Result / review page
├── leaderboard.html        # Per-quiz leaderboard
├── profile.html            # Student profile & history
│
├── css/
│   ├── variables.css       # CSS custom properties (theme tokens)
│   ├── common.css          # Global layout, navbar, glassmorphism, utilities
│   └── pages/
│       ├── auth.css        # Login / register pages
│       ├── admin.css       # Admin dashboard
│       ├── browse.css      # Quiz browser
│       ├── attempt.css     # Quiz attempt
│       ├── result.css      # Result page
│       ├── leaderboard.css # Leaderboard & podium
│       └── profile.css     # Student profile
│
├── js/
│   ├── firebase-config.js  # Firebase app initialisation
│   ├── firebase-env.js     # Environment variable loader
│   ├── auth.js             # Auth helpers & route protection
│   ├── db.js               # Firestore CRUD helpers
│   ├── utils.js            # Shared utilities (grading, formatting)
│   └── pages/
│       ├── index.js        # Landing page logic
│       ├── auth-pages.js   # Login & register logic
│       ├── admin.js        # Admin dashboard logic
│       ├── creator.js      # Quiz creator logic
│       ├── browse.js       # Quiz browser logic
│       ├── attempt.js      # Quiz attempt engine
│       ├── result.js       # Result & review logic
│       ├── leaderboard.js  # Leaderboard logic
│       └── profile.js      # Profile & history logic
│
├── package.json
└── vite.config.js (if present)
```

---

## 🛠️ Tech Stack

| Layer        | Technology                          |
|-------------|--------------------------------------|
| Frontend    | HTML5, Vanilla CSS, Vanilla JS (ESM) |
| Fonts       | Outfit (headings), Inter (body) via Google Fonts |
| Build Tool  | [Vite](https://vitejs.dev/) v5       |
| Backend     | [Firebase](https://firebase.google.com/) v10 |
| Auth        | Firebase Authentication (Email/Password) |
| Database    | Cloud Firestore (NoSQL)              |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A [Firebase](https://console.firebase.google.com/) project with:
  - **Authentication** enabled (Email/Password provider)
  - **Firestore Database** created (Start in test mode or configure rules)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/online-quiz-system.git
cd online-quiz-system
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Firebase

Create a `.env` file in the project root (or update `js/firebase-env.js`) with your Firebase project credentials:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Run the development server

```bash
npm run dev
```

Open your browser at `http://localhost:5173`.

### 5. Build for production

```bash
npm run build
```

The production-ready files will be output to the `dist/` folder.

---

## 🔐 Firestore Data Model

### `users` collection
```
users/{uid}
  ├── uid: string
  ├── name: string
  ├── email: string
  ├── role: "student" | "admin"
  └── createdAt: timestamp
```

### `quizzes` collection
```
quizzes/{quizId}
  ├── title: string
  ├── description: string
  ├── timeLimit: number          # minutes
  ├── maxAttempts: number | null # null = unlimited
  ├── passingScore: number       # percentage
  ├── questions: Question[]
  ├── createdBy: string          # admin uid
  └── createdAt: timestamp
```

### `attempts` collection
```
attempts/{attemptId}
  ├── quizId: string
  ├── studentId: string
  ├── studentName: string
  ├── answers: Record<number, number>  # questionIndex → answerIndex
  ├── score: number
  ├── totalQuestions: number
  ├── percentage: number
  ├── grade: string              # A, B, C, D, F
  ├── passed: boolean
  └── submittedAt: timestamp
```

---

## 📋 Grading Scale

| Grade | Percentage    |
|-------|--------------|
| A     | 90% – 100%   |
| B     | 75% – 89%    |
| C     | 60% – 74%    |
| D     | 45% – 59%    |
| F     | Below 45%    |

---

## 🔒 Route Protection

| Page               | Access               |
|--------------------|----------------------|
| `/login.html`      | Unauthenticated only |
| `/register.html`   | Unauthenticated only |
| `/admin-login.html`| Unauthenticated only |
| `/browse.html`     | Students only        |
| `/attempt.html`    | Students only        |
| `/result.html`     | Students only        |
| `/leaderboard.html`| Authenticated        |
| `/profile.html`    | Students only        |
| `/admin-dashboard.html` | Admins only     |
| `/quiz-creator.html`    | Admins only     |

---

## 📸 Screenshots

| Page | Preview |
|------|---------|
| Landing | Modern hero with CTA buttons |
| Browse Quizzes | Glassmorphic quiz cards with attempt counters |
| Quiz Attempt | Timed, progress-tracked question interface |
| Results | Score breakdown with per-question review |
| Leaderboard | Podium for top 3 + full ranked table |
| Profile | Personal stats and attempt history |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
