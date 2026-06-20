'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    {
      name: 'Dashboard',
      href: '/',
      icon: 'dashboard'
    },
    {
      name: 'Notes',
      href: '/notes',
      icon: 'description'
    },
    {
      name: 'Projects',
      href: '/projects',
      icon: 'folder_copy'
    },
    {
      name: 'Action Items',
      href: '/action-items',
      icon: 'checklist'
    }
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoArea}>
        <div className={styles.logoIcon}>WM</div>
        <div className={styles.logoTextContainer}>
          <span className={styles.logoText}>PM⚡</span>
          <span className={styles.logoSubtext}>AI Startup Workspace</span>
        </div>
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className={styles.name}>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <span className={styles.version}>PM Workspace v1.0</span>
        <span className={styles.statusBadge}>Local Mode</span>
      </div>
    </aside>
  );
}
