import { useEffect } from 'react';
import { Navigate, NavLink, Route, Routes, useMatch } from 'react-router-dom';
import { useAuth } from './store/auth';
import { useCreate } from './store/create';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { EditorPage } from './pages/EditorPage';
import { PromptsPage } from './pages/PromptsPage';
import { CreateHost } from './components/CreateDialog';
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
  // 编辑台自带一整条工具栏，不再套侧边栏，把宽度全留给画布
  const inEditor = useMatch('/decks/:deckId');

  const routes = (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/decks/:deckId" element={<EditorPage />} />
      <Route path="/prompts" element={<PromptsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  return (
    <>
      {inEditor ? (
        <div className="app is-editor">{routes}</div>
      ) : (
        <div className="app">
          <Sidebar />
          <main className="app-main">{routes}</main>
        </div>
      )}
      <CreateHost />
    </>
  );
}

function Sidebar() {
  const openCreate = useCreate((s) => s.open);
  return (
    <aside className="side">
      <NavLink to="/" className="side-brand" aria-label="回到首页">
        <Logo />
      </NavLink>
      <button type="button" className="btn is-primary is-block side-new" onClick={() => openCreate('file')}>
        <Icon name="plus" />
        新建图文
      </button>
      <nav className="side-nav">
        <NavLink to="/" end>
          <Icon name="grid" size={18} />
          我的作品
        </NavLink>
        <NavLink to="/prompts">
          <Icon name="prompt" size={18} />
          提示词
        </NavLink>
      </nav>
      <div className="side-tip">
        <b>小提示</b>
        <span>把 .md 文件直接拖进首页，就能马上开始生成。</span>
      </div>
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
