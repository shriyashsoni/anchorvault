export default function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '100px 20px', minHeight: '50vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <h1 style={{ fontSize: '4rem', fontWeight: 800, margin: 0, color: '#7B39FC' }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: '10px' }}>Page Not Found</h2>
      <p style={{ fontSize: '1rem', color: '#666', marginTop: '10px', maxWidth: '400px' }}>
        The developer documentation page you are looking for does not exist or has been relocated.
      </p>
      <a href="/" style={{ color: '#7B39FC', textDecoration: 'underline', display: 'inline-block', marginTop: '20px', fontWeight: 600 }}>
        Go Back Home →
      </a>
    </div>
  )
}
