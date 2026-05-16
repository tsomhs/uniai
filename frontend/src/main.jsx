import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const guestUser = { name: 'Guest', email: 'guest@local' };

function Root() {
  const [user, setUser] = useState(guestUser);

  const handleLogout = () => setUser(guestUser);

  return (
    <App user={user} setUser={setUser} onLogout={handleLogout} />
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
