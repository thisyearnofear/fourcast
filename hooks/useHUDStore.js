'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useHUDStore = create(
  persist(
    (set) => ({
      isHUDVisible: true,
      toggleHUD: () => set((s) => ({ isHUDVisible: !s.isHUDVisible })),
    }),
    {
      name: 'fourcast-hud-preference',
      partialize: (state) => ({ isHUDVisible: state.isHUDVisible }),
    }
  )
);

export default useHUDStore;
