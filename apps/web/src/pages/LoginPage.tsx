import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useAuth } from '../store/auth';
import { errorText } from '../ui/feedback';
import { Icon } from '../ui/icons';
import { Logo, PRODUCT_NAME, Spinner } from '../ui/Logo';

const FEATURES = [
  { icon: 'generate', text: 'AI 提炼改写，不是排版搬运' },
  { icon: 'layers', text: '真实测高分页，每页都装得下' },
  { icon: 'export', text: '逐字精修后一键导出整组图片' },
] as const;

export function LoginPage() {
  const login = useAuth((s) => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login(username, password);
    } catch (err) {
      setError(loginError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <section className="login-hero" aria-hidden>
        <Logo />
        <div className="login-pitch">
          <h1>
            把一篇长文
            <br />
            变成一组<em>值得收藏</em>的卡片
          </h1>
          <ul>
            {FEATURES.map((f) => (
              <li key={f.text}>
                <Icon name={f.icon} size={18} />
                {f.text}
              </li>
            ))}
          </ul>
        </div>
        <HeroArt />
      </section>

      <section className="login-side">
        <form className="login-form" onSubmit={submit} noValidate>
          <div className="login-form-head">
            <h2>欢迎回来</h2>
            <p>登录{PRODUCT_NAME}，继续你的创作</p>
          </div>

          <label className="input-field">
            <span>用户名</span>
            <div className="input-box">
              <Icon name="user" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="请输入用户名"
                autoFocus
              />
            </div>
          </label>

          <label className="input-field">
            <span>密码</span>
            <div className="input-box">
              <Icon name="lock" />
              <input
                type={reveal ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="请输入密码"
              />
              <button
                type="button"
                className="input-affix"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? '隐藏密码' : '显示密码'}
              >
                <Icon name={reveal ? 'hide' : 'show'} />
              </button>
            </div>
          </label>

          {error ? (
            <div className="form-error" role="alert">
              <Icon name="warn" />
              {error}
            </div>
          ) : null}

          <button className="btn is-primary is-lg is-block" disabled={busy}>
            {busy ? <Spinner /> : null}
            {busy ? '登录中…' : '登录'}
          </button>
        </form>
        <p className="login-foot">© {new Date().getFullYear()} {PRODUCT_NAME}</p>
      </section>
    </div>
  );
}

/** 服务端的参数校验文案是英文，登录页统一换成用户看得懂的说法 */
function loginError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 400 || err.status === 401) return '用户名或密码不正确';
    if (err.status === 0) return '网络连接失败，请检查网络后重试';
    if (err.status >= 500) return '服务暂时不可用，请稍后再试';
  }
  return errorText(err, '登录失败，请重试');
}

/** 一张长文稿拆成三张卡片的示意，纯 CSS 画，不依赖图片素材 */
function HeroArt() {
  return (
    <div className="hero-art">
      <div className="hero-doc">
        <i className="is-title" />
        {Array.from({ length: 9 }, (_, i) => (
          <i key={i} style={{ width: `${[92, 86, 96, 70, 90, 82, 94, 64, 88][i]}%` }} />
        ))}
      </div>
      <div className="hero-arrow">
        <Icon name="arrowRight" size={20} />
      </div>
      <div className="hero-cards">
        <div className="hero-card is-cover">
          <b>4 个实战项目</b>
          <strong>
            AI 到底
            <br />
            值不值
          </strong>
          <span className="hero-stats">
            <em>4</em>
            <em>72s</em>
            <em>93%</em>
          </span>
        </div>
        <div className="hero-card is-body">
          <b>01 · 开篇</b>
          <i />
          <i />
          <i style={{ width: '70%' }} />
          <span className="hero-quote" />
          <i />
          <i style={{ width: '60%' }} />
        </div>
        <div className="hero-card is-body is-back">
          <b>02 · 实测</b>
          <i />
          <i style={{ width: '80%' }} />
        </div>
      </div>
    </div>
  );
}
