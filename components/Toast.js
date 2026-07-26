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

export function ToastContainer({ toasts, removeToast, isNight = true }) {
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
 bg: "bg-[var(--color-accent)]/20 border-[var(--color-accent)]/30",
 text: "text-[var(--color-accent)]",
 link: "text-[var(--color-accent)] hover:opacity-80",
 },
 error: {
 bg: "bg-[var(--color-breach)]/20 border-[var(--color-breach)]/30",
 text: "text-[var(--color-breach)]",
 link: "text-[var(--color-breach)] hover:opacity-80",
 },
 warning: {
 bg: "bg-[var(--color-sealed)]/20 border-[var(--color-sealed)]/30",
 text: "text-[var(--color-sealed)]",
 link: "text-[var(--color-sealed)] hover:opacity-80",
 },
 info: {
 bg: "bg-[var(--color-evidence)]/20 border-[var(--color-evidence)]/30",
 text: "text-[var(--color-evidence)]",
 link: "text-[var(--color-evidence)] hover:opacity-80",
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
 className={`mc-panel p-4 pr-5 flex items-start gap-3 max-w-sm shadow-lg ${bg}`}
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
