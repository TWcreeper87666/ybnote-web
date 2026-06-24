import { create } from 'zustand';

interface ToastState {
  toastMessage: { text: string; id: number } | null;
  showToast: (msg: string) => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  toastMessage: null,
  showToast: (msg) => set({ toastMessage: { text: msg, id: Date.now() } }),
}));
