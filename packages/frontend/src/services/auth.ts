/**
 * Authentication service using AWS Amplify
 */

import { Amplify } from 'aws-amplify';
import { signIn, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import config from '../config/environment';

// Configure Amplify
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: config.cognitoUserPoolId,
      userPoolClientId: config.cognitoClientId,
    },
  },
});

export interface AuthUser {
  username: string;
  email?: string;
  groups?: string[];
}

class AuthService {
  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<void> {
    await signIn({ username: email, password });
    await this.refreshToken();
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    await signOut();
    sessionStorage.removeItem('authToken');
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const user = await getCurrentUser();
      return {
        username: user.username,
        email: user.signInDetails?.loginId,
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await getCurrentUser();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current session and refresh token
   */
  async refreshToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        sessionStorage.setItem('authToken', token);
        return token;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get JWT token from session storage
   */
  getToken(): string | null {
    return sessionStorage.getItem('authToken');
  }
}

export const authService = new AuthService();
