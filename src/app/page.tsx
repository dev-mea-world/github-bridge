'use client'
import { useEffect, useState } from 'react'

type Health = { status: 'ok'; ts: string }

export default function HomePage() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dark, setDark] = useState<boolean>(false)

  useEffect(() => {
    let alive = true
    fetch('/api/health')
      .then(async (r) => {
        if (!alive) return
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => alive && setHealth(d))
      .catch((e) => alive && setError(e?.message || 'error'))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
    if (saved) setDark(saved === 'dark')
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background: dark ? '#0b0f14' : '#fff', color: dark ? '#e6edf3' : '#111', padding: 16, borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Glor.IA GitHub Bridge</h1>
        <button onClick={() => setDark((d) => !d)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid', borderColor: dark ? '#2d333b' : '#d0d7de', background: dark ? '#161b22' : '#f6f8fa', color: 'inherit' }}>
          {dark ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>
      <p>Next.js 14 API for AI-driven GitHub operations.</p>
      <section style={{ marginTop: 24 }}>
        <h2>Health</h2>
        {health && (
          <p>
            Status: <strong>{health.status}</strong> — {new Date(health.ts).toLocaleString()}
          </p>
        )}
        {!health && !error && <p>Loading…</p>}
        {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}
      </section>
      <section style={{ marginTop: 24 }}>
        <h2>API</h2>
        <ul>
          <li><a href="/api/health">GET /api/health</a></li>
          <li><a href="/api/openapi" target="_blank" rel="noreferrer">GET /api/openapi</a></li>
        </ul>
      </section>
    </main>
  )
}
