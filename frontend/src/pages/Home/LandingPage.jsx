import React from 'react';
const LandingPage = () => {
  return (
    <main style={{
      minHeight: '100vh',
      padding: '40px 24px',
      background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
      color: '#0f172a',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <section style={{
        maxWidth: 960,
        margin: '0 auto',
        textAlign: 'center',
        padding: '40px 20px',
        borderRadius: 24,
        backgroundColor: '#ffffff',
        boxShadow: '0 24px 80px rgba(15, 23, 42, 0.08)'
      }}>
        <p style={{ margin: 0, color: '#64748b', fontSize: 16 }}>Temporary test landing page</p>
        <h1 style={{ margin: '24px 0 16px', fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1.05 }}>
          CourtSim Demo
        </h1>
        <p style={{ margin: '0 auto', maxWidth: 680, fontSize: 18, lineHeight: 1.75, color: '#334155' }}>
          This is a simple placeholder landing page for testing the app flow. Use the buttons below to navigate to sample sections and verify the routing and layout.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 32 }}>
          <a
            href="#demo"
            style={{
              padding: '14px 24px',
              borderRadius: 9999,
              backgroundColor: '#2563eb',
              color: '#ffffff',
              textDecoration: 'none',
              fontWeight: 600,
              minWidth: 140,
              textAlign: 'center'
            }}
          >
            Run Demo
          </a>
          <a
            href="#info"
            style={{
              padding: '14px 24px',
              borderRadius: 9999,
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              backgroundColor: '#f8fafc',
              textDecoration: 'none',
              fontWeight: 600,
              minWidth: 140,
              textAlign: 'center'
            }}
          >
            More Info
          </a>
        </div>
      </section>
      <section id="demo" style={{ maxWidth: 960, margin: '48px auto 0', padding: '24px 20px' }}>
        <h2 style={{ fontSize: 28, marginBottom: 16 }}>Demo Section</h2>
        <p style={{ fontSize: 16, lineHeight: 1.75, color: '#334155' }}>
          This section is built for a quick test run. Replace this content with real landing page information when the design is ready.
        </p>
      </section>
      <section id="info" style={{ maxWidth: 960, margin: '24px auto 0', padding: '24px 20px', backgroundColor: '#ffffff', borderRadius: 20, boxShadow: '0 18px 50px rgba(15, 23, 42, 0.06)' }}>
        <h2 style={{ fontSize: 28, marginBottom: 16 }}>About CourtSim</h2>
        <p style={{ fontSize: 16, lineHeight: 1.75, color: '#334155' }}>
          CourtSim is a placeholder interface for courtroom simulation testing. This page is temporary and created to verify page rendering and navigation in the frontend.
        </p>
      </section>
    </main>
  );
};

export default LandingPage;
