import { useEffect, useState } from "react";
import {
  SESSION_TIMEOUT,
  WARNING_TIME,
  CHECK_INTERVAL
} from "./sessionConfig";

export default function SessionManager({ onLogout }) {

  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {

    const updateActivity = () => {
      localStorage.setItem("lastActivity", Date.now());
    };

    const checkSession = () => {

      const last = localStorage.getItem("lastActivity");

      if (!last) return;

      const idleTime = Date.now() - Number(last);

      // show warning popup
      if (idleTime > SESSION_TIMEOUT - WARNING_TIME) {
        setShowWarning(true);
      }

      // logout
      if (idleTime > SESSION_TIMEOUT) {
        logoutUser();
      }

    };

    const logoutUser = () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.setItem("logout", Date.now());
      onLogout();
    };

    const events = [
      "mousemove",
      "keydown",
      "scroll",
      "click",
      "touchstart"
    ];

    events.forEach(e => window.addEventListener(e, updateActivity));

    updateActivity();

    const interval = setInterval(checkSession, CHECK_INTERVAL);

    return () => {
      clearInterval(interval);
      events.forEach(e => window.removeEventListener(e, updateActivity));
    };

  }, []);

  // multi-tab logout sync
  useEffect(() => {

    const syncLogout = (e) => {
      if (e.key === "logout") {
        onLogout();
      }
    };

    window.addEventListener("storage", syncLogout);

    return () => window.removeEventListener("storage", syncLogout);

  }, []);

  return (
    <>
      {showWarning && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white p-6 rounded shadow text-center">
            <h2 className="text-yellow-600 font-bold text-lg">
              Session Expiring Soon
            </h2>
            <p>You will be logged out in 5 minutes due to inactivity.</p>
          </div>
        </div>
      )}
    </>
  );
}