'use client';

export function LoadingSpinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="screen-center">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}

export function LoadingScreen({ label = 'Loading...' }: { label?: string }) {
  return (
    <main className="screen-center">
      <div className="spinner" />
      <p>{label}</p>
    </main>
  );
}

export function ErrorCard({
  title = 'Error',
  message = 'Something went wrong',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div style={{
      maxWidth: '400px',
      padding: '20px',
      textAlign: 'center',
    }}>
      <h2 style={{ margin: '0 0 10px', fontSize: '1.2rem' }}>{title}</h2>
      <p style={{ color: 'var(--muted)', margin: '0 0 20px', fontSize: '0.9rem' }}>
        {message}
      </p>
      {onRetry && (
        <button className="primary-btn" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}

export function SkeletonLoader({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="slot-skeleton"
          style={{ height: '54px', borderRadius: '14px' }}
        />
      ))}
    </div>
  );
}
