import { account, ID } from './appwrite';

export const authService = {
  // Registrazione
  register: async (email, password, name) => {
    try {
      await account.create(ID.unique(), email, password, name);
      return await account.createEmailPasswordSession(email, password);
    } catch (error) {
      throw error;
    }
  },

  // Login
  login: async (email, password) => {
    try {
      return await account.createEmailPasswordSession(email, password);
    } catch (error) {
      throw error;
    }
  },

  // Logout
  logout: async () => {
    try {
      await account.deleteSession('current');
    } catch (error) {
      console.error("Logout failed", error);
    }
  },

  // Ottieni utente corrente
  getCurrentUser: async () => {
    try {
      return await account.get();
    } catch {
      return null;
    }
  }
};
