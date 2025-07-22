import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase/init';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AdminPage from './components/AdminPage';
import Login from './components/Login';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const [accessError, setAccessError] = useState(null);
  const [isBackendOnline, setIsBackendOnline] = useState(true); // New state for backend status
  const previousBackendStatus = useRef(true); // Ref to store previous backend status

  // Effect for backend health check
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/`); // Ping the backend root
        const data = await response.json();
        const isCurrentlyOnline = response.ok && data.status === 'online';
        
        console.log("Backend Status Check:");
        console.log("  response.ok:", response.ok);
        console.log("  data.status:", data.status);
        console.log("  isCurrentlyOnline:", isCurrentlyOnline);
        console.log("  previousBackendStatus.current:", previousBackendStatus.current);

        setIsBackendOnline(isCurrentlyOnline);

        // If backend was offline and is now online, trigger a full page reload
        if (!previousBackendStatus.current && isCurrentlyOnline) {
          window.location.reload();
        }
        previousBackendStatus.current = isCurrentlyOnline;

      } catch (error) {
        console.error("Backend health check failed:", error);
        setIsBackendOnline(false);
        previousBackendStatus.current = false;
      }
    };

    // Initial check
    checkBackendStatus();

    // Set up interval for periodic checks (e.g., every 10 seconds)
    const intervalId = setInterval(checkBackendStatus, 10000); 

    return () => clearInterval(intervalId); // Clean up interval on unmount
  }, []);

  useEffect(() => {
    console.log("App.jsx: useEffect - onAuthStateChanged listener setup");
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("App.jsx: onAuthStateChanged - currentUser:", currentUser);
      setUser(currentUser);
      if (currentUser) {
        try {
          // Fetch ID token for backend authentication
          const idToken = await currentUser.getIdToken();
          console.log("App.jsx: User ID Token obtained.");

          // Re-adding the Firestore admin check based on previous context
          const appIdFromCanvas = 'booking-app-1af02'; // Hardcoded, ensure consistency
          const userProfilePath = `artifacts/${appIdFromCanvas}/users/${currentUser.uid}/profiles/userProfile`;
          const userDocRef = doc(db, userProfilePath);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists() && userDocSnap.data().role === 'admin') {
            setIsAdmin(true);
            setAccessError(null);
            console.log("App.jsx: User is admin.");
          } else {
            setIsAdmin(false);
            setAccessError("Access Denied: You do not have administrator privileges.");
            console.log("App.jsx: User is NOT admin.");
          }

        } catch (err) {
          console.error("App.jsx: Error during auth state change or role check:", err);
          setIsAdmin(false);
          setAccessError("Error checking permissions.");
        } finally {
          setAuthCheckComplete(true);
          setLoading(false);
          console.log("App.jsx: Auth check complete. Loading: false");
        }
      } else {
        // No user logged in
        console.log("App.jsx: No user logged in.");
        setIsAdmin(false);
        setAccessError(null);
        setAuthCheckComplete(true);
        setLoading(false);
      }
    });
    return () => {
      console.log("App.jsx: Cleaning up onAuthStateChanged listener.");
      unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      console.log("App.jsx: Logging out...");
      await signOut(auth);
      setUser(null);
      setIsAdmin(false);
      setAccessError(null);
      setAuthCheckComplete(false); // Reset auth check state on logout
      setLoading(true); // Set loading to true to re-trigger auth check on next render
    } catch (error) {
      console.error("App.jsx: Error logging out:", error);
    }
  };

  console.log(`App.jsx: Render - user: ${user?.uid}, loading: ${loading}, isAdmin: ${isAdmin}, authCheckComplete: ${authCheckComplete}`);

  // Show loading state while authentication check is in progress
  if (loading || !authCheckComplete) {
    return <div className="text-center text-orange-200 text-xl mt-8">Checking Admin Permissions...</div>;
  }

  // Display backend offline message if applicable
  if (!isBackendOnline) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="bg-red-800 p-8 rounded-lg shadow-xl w-full max-w-md border border-red-700 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Server Offline or Under Maintenance</h2>
          <p className="text-gray-200 mb-6">The back-end Server is offline or restarting.</p>
        </div>
      </div>
    );
  }

  // If authentication check is complete and there's no user, show the Login page
  if (!user) {
    return (
      <div className="App">
        <Login onLoginSuccess={setUser} />
      </div>
    );
  }

  // If there's a user but they are not an admin, show Access Denied
  if (user && !isAdmin) {
    return (
      <div className="App">
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md border border-gray-700 text-center">
            <h2 className="text-3xl font-bold text-red-500 mb-4">Access Denied</h2>
            <p className="text-gray-300 mb-6">{accessError || "You do not have administrator privileges."}</p>
            <button
              onClick={handleLogout}
              className="py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If there's a user AND they are an admin, show the AdminPage
  if (user && isAdmin) {
    return (
      <div className="App">
        <button
          onClick={handleLogout}
          className="absolute top-4 right-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
        >
          Logout
        </button>
        <AdminPage app={{ id: 'booking-app-1af02' }} isAdmin={isAdmin} currentUser={user} />
      </div>
    );
  }

  // Fallback, should ideally not be reached
  return null;
}

export default App;