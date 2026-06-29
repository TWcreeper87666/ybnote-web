import { useTabLock } from '../../hooks/useTabLock';
import { useSettingsStore } from '../../store/useSettingsStore';

interface Props {
  lockName: string;
  children: React.ReactNode;
}

export function SingleTabGuard({ lockName, children }: Props) {
  const status = useTabLock(lockName);
  const theme = useSettingsStore((s) => s.theme);

  if (status === 'loading') return null;

  if (status === 'blocked') {
    return (
      <div
        className={`app-container ${theme}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <div style={{ textAlign: 'center', padding: 32, maxWidth: 480 }}>
          <h2
            style={{
              color: 'var(--text-primary)',
              fontSize: 22,
              marginBottom: 12,
            }}
          >
            Already open in another tab
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}
          >
            This page is already open in another tab. Close the other tab to use it here.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
