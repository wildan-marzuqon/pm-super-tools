'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type DialogType = 'alert' | 'confirm';
type AlertSeverity = 'success' | 'info' | 'error';

interface DialogOptions {
  type: DialogType;
  title: string;
  message: string;
  severity?: AlertSeverity;
  confirmText?: string;
  cancelText?: string;
  resolver: (value: boolean) => void;
}

interface ModalContextType {
  alert: (message: string, title?: string, severity?: AlertSeverity) => Promise<void>;
  confirm: (message: string, title?: string, confirmText?: string, cancelText?: string) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModalDialog = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModalDialog must be used within a ModalProvider');
  }
  return context;
};

export default function ModalProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);

  const alert = (message: string, title = 'Notifikasi', severity: AlertSeverity = 'info'): Promise<void> => {
    return new Promise((resolve) => {
      setDialog({
        type: 'alert',
        title,
        message,
        severity,
        confirmText: 'OK',
        resolver: () => {
          setDialog(null);
          resolve();
        }
      });
    });
  };

  const confirm = (
    message: string,
    title = 'Konfirmasi',
    confirmText = 'Ya, Lanjutkan',
    cancelText = 'Batal'
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        type: 'confirm',
        title,
        message,
        confirmText,
        cancelText,
        resolver: (value) => {
          setDialog(null);
          resolve(value);
        }
      });
    });
  };

  return (
    <ModalContext.Provider value={{ alert, confirm }}>
      {children}
      {dialog && (
        <div style={overlayStyle} onClick={() => dialog.type === 'alert' && dialog.resolver(false)}>
          <div style={modalStyle} className="animate-popover" onClick={(e) => e.stopPropagation()}>
            <div style={headerStyle(dialog.severity)}>
              <span style={titleStyle(dialog.severity)}>
                {dialog.severity === 'success' && '✅ '}
                {dialog.severity === 'error' && '⚠️ '}
                {dialog.severity === 'info' && '💡 '}
                {dialog.title}
              </span>
              <button style={closeButtonStyle} onClick={() => dialog.resolver(false)}>×</button>
            </div>
            <div style={bodyStyle}>
              <p style={messageStyle}>{dialog.message}</p>
            </div>
            <div style={dialog.type === 'confirm' ? footerConfirmStyle : footerStyle}>
              {dialog.type === 'confirm' && (
                <button style={cancelButtonStyle} onClick={() => dialog.resolver(false)}>
                  {dialog.cancelText || 'Batal'}
                </button>
              )}
              <button style={confirmButtonStyle(dialog.severity)} onClick={() => dialog.resolver(true)}>
                {dialog.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

// Inline Styles to guarantee visual alignment and zero stylesheet loading lag.
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.45)', // Slate-900 with transparency
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  fontFamily: 'var(--font-fira-sans), sans-serif',
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  width: '420px',
  maxWidth: '90vw',
  borderRadius: '16px',
  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.05)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle = (severity?: AlertSeverity): React.CSSProperties => {
  let bgColor = '#FFFDF5'; // Light yellow default
  let borderColor = '#FEF08A';
  if (severity === 'success') {
    bgColor = '#ECFDF5'; // green-50
    borderColor = '#A7F3D0';
  } else if (severity === 'error') {
    bgColor = '#FEF2F2'; // red-50
    borderColor = '#FCA5A5';
  }

  return {
    padding: '16px 20px',
    backgroundColor: bgColor,
    borderBottom: `1px solid ${borderColor}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };
};

const titleStyle = (severity?: AlertSeverity): React.CSSProperties => {
  let color = '#B45309'; // Amber-700
  if (severity === 'success') color = '#047857';
  else if (severity === 'error') color = '#B91C1C';

  return {
    fontSize: '15px',
    fontWeight: 700,
    color: color,
  };
};

const closeButtonStyle: React.CSSProperties = {
  fontSize: '22px',
  color: '#9CA3AF',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '0 4px',
  lineHeight: 1,
};

const bodyStyle: React.CSSProperties = {
  padding: '24px 20px',
};

const messageStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#4B5563', // Slate-600
  lineHeight: '1.6',
  fontWeight: 500,
};

const footerStyle: React.CSSProperties = {
  padding: '12px 20px',
  backgroundColor: '#F9FAFB',
  borderTop: '1px solid #E5E7EB',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '10px',
};

const footerConfirmStyle: React.CSSProperties = {
  padding: '12px 20px',
  backgroundColor: '#F9FAFB',
  borderTop: '1px solid #E5E7EB',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '10px',
};

const cancelButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  backgroundColor: '#ffffff',
  border: '1px solid #D1D5DB',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  cursor: 'pointer',
};

const confirmButtonStyle = (severity?: AlertSeverity): React.CSSProperties => {
  let bgColor = '#F59E0B'; // primary amber
  if (severity === 'success') {
    bgColor = '#10B981'; // emerald
  } else if (severity === 'error') {
    bgColor = '#EF4444'; // red
  }

  return {
    padding: '8px 16px',
    backgroundColor: bgColor,
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  };
};
