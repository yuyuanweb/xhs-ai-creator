import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { FeedbackHost } from './ui/feedback';
import { Icon } from './ui/icons';
import { Logo } from './ui/Logo';

export function App() {
  return (
    <>
      <div className="app">
        <Sidebar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <FeedbackHost />
    </>
  );
}

function Sidebar() {
  return (
    <aside className="side">
      <NavLink to="/" className="side-brand" aria-label="回到首页">
        <Logo />
      </NavLink>
      <nav className="side-nav">
        <NavLink to="/" end>
          <Icon name="grid" size={18} />
          我的作品
        </NavLink>
      </nav>
    </aside>
  );
}
