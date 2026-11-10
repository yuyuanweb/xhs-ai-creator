import { useEffect } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './store/auth';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { FeedbackHost } from './ui/feedback';
import { Icon } from './ui/icons';
import { Logo, LogoMark, Spinner } from './ui/Logo';
import { Menu } from './ui/Menu';

export function App() {
  const { user, loading, restore } = useAuth();

  useEffect(() => {
    void restore();
  }, [restore]);

  return (
    <>
      {loading ? <BootScreen /> : user ? <Shell /> : <LoginPage />}
      <FeedbackHost />
    </>
  );
}

function BootScreen() {
  return (
    <div className="boot">
      <LogoMark size={40} />
      <Spinner size={18} />
    </div>
  );
}

function Shell() {
  return (
    <div className="app">
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
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
      <UserMenu />
    </aside>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const role = user.role === 'admin' ? '管理员' : '成员';
  return (
    <Menu
      className="side-user"
      label="账号菜单"
      side="top"
      align="start"
      trigger={
        <>
          <span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span>
          <span className="side-user-name">
            <b>{user.username}</b>
            <span>{role}</span>
          </span>
          <Icon name="more" size={16} />
        </>
      }
      items={[{ label: '退出登录', icon: 'logout', onSelect: logout }]}
    />
  );
}
