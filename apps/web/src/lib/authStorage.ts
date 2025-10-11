export const UNAUTHORIZED_EVENT = 'auravet:unauthorized';

const STORAGE_KEY = 'auravet:token';

export const authStorage = {
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(STORAGE_KEY);
  },
  setToken: (token: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, token);
  },
  clearToken: () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(STORAGE_KEY);
  },
};
