"use client";

import React, { useState, useEffect } from "react";

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = "success", duration = 4000, action = null, actionLabel = null) => {
    const id = Date.now();
    const newToast = { id, message, type, isVisible: true, action, actionLabel };

    setToasts((prev) => [...prev, newToast]);

    if (duration) {
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, isVisible: false } : t))
        );

        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 300);
      }, duration);
    }

    return id;
  };

  const removeToast = (id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isVisible: false } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  };

  return { toasts, addToast, removeToast };
}

export function ToastContainer({ toasts, removeToast, isNight = false }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onRemove={() => removeToast(toast.id)}
          isNight={isNight}
        />
      ))}
    </div>
  );
}

function Toast({ toast, onRemove, isNight }) {
  const getIcon = (type) => {
    const icons = {
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️",
    };
    return icons[type] || "💬";
  };

  const getColors = (type, isNight) => {
    const colorMap = {
      success: {
        bg: isNight
          ? "bg-green-500/20 border-green-400/30"
          : "bg-green-400/20 border-green-500/30",
        text: isNight ? "text-green-200" : "text-green-800",
        link: isNight ? "text-green-300 hover:text-green-100" : "text-green-900 hover:text-green-700",
      },
      error: {
        bg: isNight
          ? "bg-red-500/20 border-red-400/30"
          : "bg-red-400/20 border-red-500/30",
        text: isNight ? "text-red-200" : "text-red-800",
        link: isNight ? "text-red-300 hover:text-red-100" : "text-red-900 hover:text-red-700",
      },
      warning: {
        bg: isNight
          ? "bg-yellow-500/20 border-yellow-400/30"
          : "bg-yellow-400/20 border-yellow-500/30",
        text: isNight ? "text-yellow-200" : "text-yellow-800",
        link: isNight ? "text-yellow-300 hover:text-yellow-100" : "text-yellow-900 hover:text-yellow-700",
      },
      info: {
        bg: isNight
          ? "bg-blue-500/20 border-blue-400/30"
          : "bg-blue-400/20 border-blue-500/30",
        text: isNight ? "text-blue-200" : "text-blue-800",
        link: isNight ? "text-blue-300 hover:text-blue-100" : "text-blue-900 hover:text-blue-700",
      },
    };
    return colorMap[type] || colorMap.info;
  };

  const { bg, text, link } = getColors(toast.type, isNight);

  // Check if toast has action (link)
  const hasAction = toast.action && toast.actionLabel;

  return (
    <div
      className={`pointer-events-auto transform transition-all duration-300 ${
        toast.isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
      }`}
    >
      <div
        className={`glass-surface rounded-2xl p-4 pr-5 flex items-start gap-3 max-w-sm shadow-lg ${bg}`}
      >
        <span className="text-lg flex-shrink-0 mt-0.5">{getIcon(toast.type)}</span>
        <div className="flex-1">
          <p className={`text-sm font-light ${text} leading-relaxed`}>
            {toast.message}
          </p>
          {hasAction && (
            <a
              href={toast.action}
              className={`inline-block mt-2 text-xs font-medium underline transition-colors ${link}`}
              onClick={onRemove}
            >
              {toast.actionLabel} →
            </a>
          )}
        </div>
        <button
          onClick={onRemove}
          className={`text-lg flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity`}
        >
          ×
        </button>
      </div>
    </div>
  );
}
