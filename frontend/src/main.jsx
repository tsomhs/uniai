import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function Root() {
  const [user, setUser] = useState(null); // null means we are fetching the initial session

  useEffect(() => {
    // Silently create an isolated guest session on the backend
    fetch('http://localhost:8000/api/auth/guest', {
      method: 'POST',
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => setUser(data))
      .catch(err => {
        console.error("Failed to fetch guest session:", err);
        // Fallback just in case the backend is down
        setUser({ name: 'Guest', email: 'guest@local' }); 
      });
  }, []);

  const handleLogout = () => {
    // Easiest way to "log out" a user and turn them back into a new guest 
    // is to just refresh the page so the useEffect runs again!
    window.location.reload();
  };

  // Prevent App from rendering (and throwing 401s) before the cookie is set
  if (!user) {
    return <div style={{ height: '100vh', backgroundColor: '#09090b' }} />; 
  }

  return (
    <App user={user} setUser={setUser} onLogout={handleLogout} />
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)