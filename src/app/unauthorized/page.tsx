'use client';

import Link from 'next/link';
import styles from './page.module.css';

export default function UnauthorizedPage() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.icon}>🚫</div>
        <h1>Akses Ditolak / Forbidden</h1>
        <p>
          Anda tidak memiliki hak akses (capability) yang diperlukan untuk membuka halaman ini. Silakan hubungi Administrator jika ini merupakan kesalahan.
        </p>
        <div className={styles.actions}>
          <Link href="/" className={styles.primaryBtn}>
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
