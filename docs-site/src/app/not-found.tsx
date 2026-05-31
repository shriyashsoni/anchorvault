export default function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '100px 20px', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090b', color: '#fafafa', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ padding: '40px', borderRadius: '16px', border: '1px solid #27272a', backgroundColor: '#18181b', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)', maxWidth: '480px' }}>
        <h1 style={{ fontSize: '5rem', fontWeight: 900, margin: 0, background: 'linear-gradient(to right, #a855f7, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.05em' }}>404</h1>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '10px', color: '#f4f4f5' }}>Page Not Found</h2>
        <p style={{ fontSize: '1rem', color: '#a1a1aa', marginTop: '12px', lineHeight: '1.6' }}>
          The developer documentation page you are looking for does not exist or has been relocated to another track.
        </p>
        <a href="/docs" style={{ display: 'inline-block', marginTop: '24px', padding: '12px 24px', backgroundColor: '#7B39FC', color: '#ffffff', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', boxShadow: '0 4px 12px rgba(123, 57, 252, 0.3)' }}>
          Go to Documentation →
        </a>
      </div>
    </div>
  )
}
