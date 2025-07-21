# GEMINI.md - Project Overview

This document provides a high-level overview of the `admin-front-end` application, intended for context when interacting with other Gemini instances.

## 1. Project Purpose

This is a **React-based admin dashboard** for the DJ booking application. It allows administrators to:

*   View all bookings in the system.
*   Create new bookings for users.
*   Manage user accounts.
*   Send login details to users.

## 2. Technology Stack

*   **Frontend Framework:** React.js (with Vite for fast development)
*   **Styling:** Tailwind CSS
*   **State Management:** React Hooks (`useState`, `useEffect`)
*   **Backend Communication:** Native Fetch API
*   **Authentication:** Firebase Authentication

## 3. Key Features & Components

*   **Admin Page:** The main interface for managing bookings and users.
*   **Login:** A dedicated login page for administrators.
*   **Firebase Integration:** Securely authenticates administrators.
*   **Backend API Interaction:** Communicates with the backend to fetch data and perform administrative tasks.

## 4. Project Structure Highlights

*   `src/App.jsx`: The main application component, which handles routing and authentication.
*   `src/components/AdminPage.jsx`: The component that renders the admin dashboard.
*   `src/components/Login.jsx`: The component that handles administrator login.
*   `src/firebase/init.js`: Initializes the Firebase application.

## 5. Development & Deployment Notes

*   **Environment Variables:** The backend API URL is configured via `VITE_BACKEND_API_BASE_URL` in `.env`.
*   **Proxy Configuration:** The `vite.config.js` file is configured to proxy API requests to the backend to avoid CORS errors during development.

## 6. Related Projects

*   **User-Facing Frontend:** A separate `vite-project` that provides the user-facing booking interface.
*   **Backend API:** A `standalone-backend` that serves both the admin dashboard and the user-facing frontend.
