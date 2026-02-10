'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Context untuk Alert Modal
const AlertModalContext = createContext(null);

export function useAlertModal() {
  const context = useContext(AlertModalContext);
  if (!context) {
    throw new Error('useAlertModal must be used within AlertModalProvider');
  }
  return context;
}

// Animated Icon Components with SVG animations
const SuccessIcon = () => (
  <div className="relative">
    <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
    <div className="relative w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth="3" 
          d="M5 13l4 4L19 7"
          className="animate-draw-check"
          style={{
            strokeDasharray: 24,
            strokeDashoffset: 24,
            animation: 'drawCheck 0.4s ease-out 0.2s forwards'
          }}
        />
      </svg>
    </div>
  </div>
);

const ErrorIcon = () => (
  <div className="relative">
    <div className="absolute inset-0 bg-rose-500/20 rounded-full animate-ping" />
    <div className="relative w-20 h-20 bg-gradient-to-br from-rose-400 to-rose-600 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/30">
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  </div>
);

const WarningIcon = () => (
  <div className="relative">
    <div className="absolute inset-0 bg-amber-500/20 rounded-full animate-pulse" />
    <div className="relative w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30">
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
  </div>
);

const InfoIcon = () => (
  <div className="relative">
    <div className="absolute inset-0 bg-sky-500/20 rounded-full animate-pulse" />
    <div className="relative w-20 h-20 bg-gradient-to-br from-sky-400 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-sky-500/30">
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  </div>
);

const QuestionIcon = () => (
  <div className="relative">
    <div className="absolute inset-0 bg-violet-500/20 rounded-full animate-pulse" />
    <div className="relative w-20 h-20 bg-gradient-to-br from-violet-400 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-violet-500/30">
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  </div>
);

const getIcon = (type) => {
  switch (type) {
    case 'success':
      return <SuccessIcon />;
    case 'error':
      return <ErrorIcon />;
    case 'warning':
      return <WarningIcon />;
    case 'info':
      return <InfoIcon />;
    case 'confirm':
      return <QuestionIcon />;
    default:
      return <InfoIcon />;
  }
};

const getGradientBorder = (type) => {
  switch (type) {
    case 'success':
      return 'before:bg-gradient-to-r before:from-emerald-500 before:via-green-400 before:to-emerald-500';
    case 'error':
      return 'before:bg-gradient-to-r before:from-rose-500 before:via-red-400 before:to-rose-500';
    case 'warning':
      return 'before:bg-gradient-to-r before:from-amber-500 before:via-orange-400 before:to-amber-500';
    case 'info':
      return 'before:bg-gradient-to-r before:from-sky-500 before:via-blue-400 before:to-sky-500';
    case 'confirm':
      return 'before:bg-gradient-to-r before:from-violet-500 before:via-purple-400 before:to-violet-500';
    default:
      return 'before:bg-gradient-to-r before:from-primary-500 before:via-primary-400 before:to-primary-500';
  }
};

const getButtonStyle = (type) => {
  switch (type) {
    case 'success':
      return 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40';
    case 'error':
      return 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40';
    case 'warning':
      return 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40';
    case 'info':
      return 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40';
    case 'confirm':
      return 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40';
    default:
      return 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 shadow-lg shadow-primary-500/25';
  }
};

// Alert Modal Component
function AlertModalContent({ modal, onClose }) {
  const [inputValue, setInputValue] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    setInputValue('');
    setIsClosing(false);
  }, [modal]);

  if (!modal) return null;

  const { type, title, message, onConfirm, onCancel, confirmText, cancelText, showInput, inputPlaceholder } = modal;

  const handleClose = (result) => {
    setIsClosing(true);
    setTimeout(() => {
      if (result === 'confirm') {
        if (showInput) {
          onConfirm?.(inputValue);
        } else {
          onConfirm?.();
        }
      } else {
        onCancel?.();
      }
      onClose();
    }, 150);
  };

  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}>
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-dark-950/90 backdrop-blur-md"
        onClick={type !== 'confirm' && !showInput ? () => handleClose('cancel') : undefined}
      />
      
      {/* Floating particles effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl animate-float-delayed" />
      </div>
      
      {/* Modal Card */}
      <div className={`relative w-full max-w-md ${isClosing ? 'animate-scaleOut' : 'animate-modalIn'}`}>
        {/* Gradient border effect */}
        <div className={`absolute -inset-[1px] rounded-3xl ${getGradientBorder(type)} before:absolute before:inset-0 before:rounded-3xl before:opacity-75 before:animate-gradient-x`} />
        
        <div className="relative bg-dark-900/95 backdrop-blur-xl rounded-3xl overflow-hidden">
          {/* Top glow effect */}
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 opacity-20 blur-3xl ${
            type === 'success' ? 'bg-emerald-500' :
            type === 'error' ? 'bg-rose-500' :
            type === 'warning' ? 'bg-amber-500' :
            type === 'info' ? 'bg-sky-500' :
            'bg-violet-500'
          }`} />
          
          {/* Content */}
          <div className="relative p-8">
            {/* Icon with animation */}
            <div className="flex justify-center mb-6">
              {getIcon(type)}
            </div>
            
            {/* Title */}
            <h3 className="text-2xl font-bold text-center text-white mb-3 tracking-tight">
              {title}
            </h3>
            
            {/* Message */}
            <p className="text-dark-300 text-center mb-8 leading-relaxed text-base">
              {message}
            </p>
            
            {/* Input field for prompt */}
            {showInput && (
              <div className="mb-6">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={inputPlaceholder || 'Masukkan teks...'}
                  className="w-full px-5 py-4 bg-dark-800/80 border-2 border-dark-600 rounded-2xl text-white placeholder:text-dark-500 focus:outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/10 transition-all duration-300"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleClose('confirm')}
                />
              </div>
            )}
            
            {/* Buttons */}
            <div className={`flex gap-4 ${type === 'confirm' || showInput ? 'justify-center' : 'justify-center'}`}>
              {(type === 'confirm' || showInput) && (
                <button
                  onClick={() => handleClose('cancel')}
                  className="flex-1 max-w-[140px] py-3.5 px-6 bg-dark-700/80 hover:bg-dark-600 text-dark-200 hover:text-white rounded-2xl 
                           transition-all duration-300 font-semibold border border-dark-600 hover:border-dark-500
                           hover:scale-[1.02] active:scale-[0.98]"
                >
                  {cancelText || 'Batal'}
                </button>
              )}
              <button
                onClick={() => handleClose('confirm')}
                className={`flex-1 max-w-[180px] py-3.5 px-6 text-white rounded-2xl font-semibold
                  transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]
                  ${getButtonStyle(type)}
                `}
              >
                {confirmText || 'OK'}
              </button>
            </div>
          </div>
          
          {/* Bottom decorative line */}
          <div className={`h-1 w-full ${
            type === 'success' ? 'bg-gradient-to-r from-transparent via-emerald-500 to-transparent' :
            type === 'error' ? 'bg-gradient-to-r from-transparent via-rose-500 to-transparent' :
            type === 'warning' ? 'bg-gradient-to-r from-transparent via-amber-500 to-transparent' :
            type === 'info' ? 'bg-gradient-to-r from-transparent via-sky-500 to-transparent' :
            'bg-gradient-to-r from-transparent via-violet-500 to-transparent'
          }`} />
        </div>
      </div>
    </div>
  );
}

// Provider Component
export function AlertModalProvider({ children }) {
  const [modal, setModal] = useState(null);

  const showAlert = useCallback((options) => {
    return new Promise((resolve) => {
      setModal({
        type: options.type || 'info',
        title: options.title || 'Informasi',
        message: options.message || '',
        confirmText: options.confirmText,
        cancelText: options.cancelText,
        showInput: options.showInput || false,
        inputPlaceholder: options.inputPlaceholder,
        onConfirm: (value) => resolve(value !== undefined ? value : true),
        onCancel: () => resolve(false),
      });
    });
  }, []);

  // Shorthand methods
  const success = useCallback((message, title = 'Berhasil!') => {
    return showAlert({ type: 'success', title, message });
  }, [showAlert]);

  const error = useCallback((message, title = 'Oops!') => {
    return showAlert({ type: 'error', title, message });
  }, [showAlert]);

  const warning = useCallback((message, title = 'Perhatian') => {
    return showAlert({ type: 'warning', title, message });
  }, [showAlert]);

  const info = useCallback((message, title = 'Informasi') => {
    return showAlert({ type: 'info', title, message });
  }, [showAlert]);

  const confirm = useCallback((message, title = 'Konfirmasi', options = {}) => {
    return showAlert({ 
      type: 'confirm', 
      title, 
      message,
      confirmText: options.confirmText || 'Ya, Lanjutkan',
      cancelText: options.cancelText || 'Batal',
    });
  }, [showAlert]);

  const prompt = useCallback((message, title = 'Input', options = {}) => {
    return showAlert({
      type: 'confirm',
      title,
      message,
      showInput: true,
      inputPlaceholder: options.placeholder,
      confirmText: options.confirmText || 'Submit',
      cancelText: options.cancelText || 'Batal',
    });
  }, [showAlert]);

  const closeModal = useCallback(() => {
    setModal(null);
  }, []);

  return (
    <AlertModalContext.Provider value={{ showAlert, success, error, warning, info, confirm, prompt }}>
      {children}
      <AlertModalContent modal={modal} onClose={closeModal} />
    </AlertModalContext.Provider>
  );
}
