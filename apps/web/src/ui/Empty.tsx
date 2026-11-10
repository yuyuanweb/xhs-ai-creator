import { Icon, type IconName } from './icons';

export function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: IconName;
  title: string;
  text: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <strong>{title}</strong>
      <p>{text}</p>
      {action ? (
        <button type="button" className="btn" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
