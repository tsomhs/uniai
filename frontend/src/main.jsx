import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function Root() {
  const [user, setUser] = useState(null); // null means loading

  useEffect(() => {
    // Silently create an isolated guest session on the backend
    fetch('http://localhost:8000/api/auth/guest', {
      method: 'POST',
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json();
      })
      .then(data => setUser(data))
      .catch(err => {
        console.error("Failed to fetch guest session:", err);
        // Fallback so the app STILL OPENS even if the backend route is missing/down
        setUser({ name: 'Guest', email: 'guest@local' }); 
      });
  }, []);

  const handleLogout = () => {
    window.location.reload();
  };

  // Prevent App from rendering before we either get a real session or fallback
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