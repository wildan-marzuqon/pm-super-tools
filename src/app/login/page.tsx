'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Email dan password harus diisi');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (res.ok) {
        // Refresh page router context to update middleware state
        router.push('/');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Email atau password salah');
      }
    } catch (err: any) {
      console.error('Login submit error:', err);
      setError('Terjadi kesalahan koneksi internet');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.cardHeader}>
          <span className={styles.logoIcon}>⚡</span>
          <h1>PM Super Tools</h1>
          <p>Asisten Produktivitas & Kolaborasi Project Manager</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.loginForm}>
          {error && <div className={styles.errorMessage}>⚠️ {error}</div>}

          <div className={styles.inputGroup}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="nama@pmtools.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <button type="submit" className={styles.loginBtn} disabled={isLoading}>
            {isLoading ? 'Memproses Masuk...' : 'Masuk ke Platform'}
          </button>
        </form>
        
        <div className={styles.cardFooter}>
          <p>Default Admin: <strong>admin@pmtools.com</strong> / <strong>Admin123!</strong></p>
        </div>
      </div>
    </div>
  );
}
