const TOKEN_KEY = 'auth_token';

const isLocalStorageAvailable = () => {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

// Fallback in-memory storage for environments where localStorage is not available
let memoryStorage: Record<string, string> = {};

export const saveToken = (token: string) => {
  try {
    if (isLocalStorageAvailable()) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      memoryStorage[TOKEN_KEY] = token;
    }
  } catch (e) {
    console.warn('Failed to set token:', e);
    memoryStorage[TOKEN_KEY] = token;
  }
};

export const setToken = saveToken;

export const getToken = (): string | null => {
  try {
    if (isLocalStorageAvailable()) {
      return localStorage.getItem(TOKEN_KEY);
    } else {
      return memoryStorage[TOKEN_KEY] || null;
    }
  } catch (e) {
    console.warn('Failed to get token:', e);
    return memoryStorage[TOKEN_KEY] || null;
  }
};

export const removeToken = () => {
  try {
    if (isLocalStorageAvailable()) {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch (storageError) {
        console.warn('localStorage removal failed, using memory:', storageError);
        delete memoryStorage[TOKEN_KEY];
      }
    } else {
      delete memoryStorage[TOKEN_KEY];
    }
  } catch (e) {
    console.warn('Failed to remove token:', e);
    // Fallback: always ensure memory storage is cleared
    if (memoryStorage[TOKEN_KEY]) {
      delete memoryStorage[TOKEN_KEY];
    }
  }
};

export const isAuthenticated = (): boolean => {
  return !!getToken();
};