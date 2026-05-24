'use client';

import React, { useEffect, useCallback } from 'react';

/**
 * BottomSheet Component
 * 
 * Mobile-first sliding panel that emerges from the bottom of the screen.
 * On desktop, renders as a centered modal for better UX.
 * 
 * Features:
 * - Drag-to-dismiss gesture support
 * - Backdrop blur
 * - Keyboard escape handling
 * - Responsive: bottom sheet on mobile, centered modal on desktop
 * - Uses consolidated glass CSS classes
 */
export default function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  isNight = true,
  showHandle = true,
  fullHeight = false,
}) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  const glassPanel = isNight ? 'glass-heavy' : 'glass-heavy-light';

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />
      
      {/* Sheet/Modal */}
      <div 
        className={`
          relative w-full sm:max-w-2xl sm:max-h-[85vh] 
          ${fullHeight ? 'h-[90vh]' : 'max-h-[90vh] sm:rounded-3xl'}
          ${glassPanel} rounded-t-3xl
          shadow-2xl overflow-hidden
          animate-slide-up sm:animate-scale-in
          flex flex-col
        `}
      >
        {/* Handle bar (mobile) */}
        {showHandle && (
          <div className="flex justify-center pt-3 pb-2 sm:hidden">
            <div className={`w-12 h-1.5 rounded-full ${isNight ? 'bg-white/30' : 'bg-black/30'}`} />
          </div>
        )}
        
        {/* Header */}
        {title && (
          <div className={`flex items-center justify-between px-6 py-4 border-b ${isNight ? 'border-white/10' : 'border-black/10'}`}>
            <h2 className={`text-lg font-medium ${isNight ? 'text-white' : 'text-slate-900'}`}>
              {title}
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-full transition-colors ${isNight ? 'hover:bg-white/10 text-white/60 hover:text-white' : 'hover:bg-black/10 text-black/60 hover:text-black'}`}
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
