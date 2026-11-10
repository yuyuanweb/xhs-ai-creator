import type { AgentPhase } from '@rcs/shared';
import type { UseAgentResult } from '../../agent/useAgent';
import { Icon } from '../../ui/icons';

const PHASE_TEXT: Record<AgentPhase, string> = {
  idle: '',
  drafting: '正在写初稿',
  measuring: '正在测量排版',
  done: '已完成',
  failed: '失败',
};

/** 顶栏上的一行进度 */
export function AgentStatus({ agent }: { agent: UseAgentResult }) {
  const { phase, note, error } = agent.state;
  if (phase === 'idle') return <div className="st-status" />;

  const text = error || note || PHASE_TEXT[phase];
  return (
    <div className={`st-status is-${phase}`}>
      <i />
      <span>{text}</span>
    </div>
  );
}

/**
 * 画布上方的锁定条。Agent 跑着的时候卡片和面板都改不了，
 * 只靠顶栏那行灰字，用户会以为已经能编辑了，点了却没反应
 */
export function AgentLock({ agent }: { agent: UseAgentResult }) {
  if (!agent.running) return null;
  const { phase } = agent.state;

  return (
    <div className="st-lock" role="status">
      <i />
      <b>
        {PHASE_TEXT[phase]}
      </b>
      <span>完成前卡片和面板都不能编辑</span>
      <button type="button" onClick={agent.stop}>
        <Icon name="stop" size={14} />
        停止并编辑
      </button>
    </div>
  );
}

/** 面板顶部的同一句提示，面板变灰时告诉用户为什么 */
export function AgentLockNote() {
  return (
    <div className="pane-lock">
      <Icon name="warn" size={14} />
      AI 正在修改这一稿，完成后才能编辑。想现在就改，点画布上方的「停止并编辑」。
    </div>
  );
}
