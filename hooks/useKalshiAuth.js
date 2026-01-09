'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Kalshi Authentication Store
 * Manages user authentication state, token expiry, and auto-logout
 */
const useKalshiAuth = create(
    persist(
        (set, get) => ({
            // State
            token: null,
            memberId: null,
            expiry: null,
            isAuthenticated: false,

            /**
             * Login and store credentials
             */
            setAuth: (token, memberId, expiry) => {
                set({
                    token,
                    memberId,
                    expiry,
                    isAuthenticated: true
                });
            },

            /**
             * Logout and clear credentials
             */
            logout: () => {
                set({
                    token: null,
                    memberId: null,
                    expiry: null,
                    isAuthenticated: false
                });
            },

            /**
             * Check if token is valid (not expired)
             * Returns true if authenticated and token is valid
             */
            checkAuth: () => {
                const { expiry, token, logout } = get();

                if (!token || !expiry) {
                    return false;
                }

                const now = Date.now();
                if (now >= expiry) {
                    // Token expired, auto-logout
                    logout();
                    return false;
                }

                return true;
            },

            /**
             * Get valid token (returns null if expired)
             */
            getValidToken: () => {
                const { checkAuth, token } = get();
                return checkAuth() ? token : null;
            }
        }),
        {
            name: 'kalshi-auth-storage',
            partialize: (state) => ({
                token: state.token,
                memberId: state.memberId,
                expiry: state.expiry,
                isAuthenticated: state.isAuthenticated
            })
        }
    )
);

export default useKalshiAuth;
