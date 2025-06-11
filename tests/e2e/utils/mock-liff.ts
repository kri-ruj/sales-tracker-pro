import { Page } from '@playwright/test';

export interface MockLIFFProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface MockLIFFConfig {
  isLoggedIn: boolean;
  isInClient: boolean;
  profile?: MockLIFFProfile;
  os: 'ios' | 'android' | 'web';
  language: string;
}

/**
 * Mock LIFF SDK for E2E testing
 */
export class MockLIFF {
  private page: Page;
  private config: MockLIFFConfig;

  constructor(page: Page, config: Partial<MockLIFFConfig> = {}) {
    this.page = page;
    this.config = {
      isLoggedIn: false,
      isInClient: true,
      os: 'web',
      language: 'th',
      ...config
    };
  }

  async setup() {
    // Inject mock LIFF before page loads
    await this.page.addInitScript((config) => {
      // Create mock LIFF object
      (window as any).liff = {
        ready: Promise.resolve(),
        
        init: ({ liffId }: { liffId: string }) => {
          console.log(`Mock LIFF initialized with ID: ${liffId}`);
          return Promise.resolve();
        },

        isLoggedIn: () => config.isLoggedIn,
        
        isInClient: () => config.isInClient,
        
        login: (options?: any) => {
          console.log('Mock LIFF login called', options);
          window.location.href = options?.redirectUri || '/';
        },
        
        logout: () => {
          console.log('Mock LIFF logout called');
          config.isLoggedIn = false;
          window.location.reload();
        },
        
        getProfile: () => {
          if (!config.isLoggedIn || !config.profile) {
            return Promise.reject(new Error('User not logged in'));
          }
          return Promise.resolve(config.profile);
        },
        
        getOS: () => config.os,
        
        getLanguage: () => config.language,
        
        getVersion: () => '2.22.0',
        
        isApiAvailable: (api: string) => {
          const availableApis = ['shareTargetPicker', 'multipleLiffTransition'];
          return availableApis.includes(api);
        },
        
        sendMessages: (messages: any[]) => {
          console.log('Mock LIFF sendMessages:', messages);
          return Promise.resolve();
        },
        
        openWindow: (params: { url: string; external?: boolean }) => {
          console.log('Mock LIFF openWindow:', params);
          window.open(params.url, params.external ? '_blank' : '_self');
        },
        
        closeWindow: () => {
          console.log('Mock LIFF closeWindow');
          window.close();
        },
        
        getIDToken: () => 'mock-id-token-' + Date.now(),
        
        getDecodedIDToken: () => ({
          iss: 'https://access.line.me',
          sub: config.profile?.userId || 'U1234567890',
          aud: '2007552096-wrG1aV9p',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          name: config.profile?.displayName || 'Test User',
          picture: config.profile?.pictureUrl
        }),
        
        getContext: () => ({
          type: 'utou',
          viewType: 'full',
          userId: config.profile?.userId,
          utouId: 'mock-utou-id'
        })
      };
      
      // Store config in window for updates
      (window as any).__mockLiffConfig = config;
    }, this.config);
  }

  async login(profile: MockLIFFProfile) {
    this.config.isLoggedIn = true;
    this.config.profile = profile;
    
    // Update the config in the page
    await this.page.evaluate((profile) => {
      (window as any).__mockLiffConfig.isLoggedIn = true;
      (window as any).__mockLiffConfig.profile = profile;
    }, profile);
  }

  async logout() {
    this.config.isLoggedIn = false;
    this.config.profile = undefined;
    
    await this.page.evaluate(() => {
      (window as any).__mockLiffConfig.isLoggedIn = false;
      (window as any).__mockLiffConfig.profile = undefined;
    });
  }

  async setInClient(inClient: boolean) {
    this.config.isInClient = inClient;
    
    await this.page.evaluate((inClient) => {
      (window as any).__mockLiffConfig.isInClient = inClient;
    }, inClient);
  }
}

/**
 * Default test profiles
 */
export const TEST_PROFILES = {
  user1: {
    userId: 'U0001',
    displayName: 'Test User 1',
    pictureUrl: 'https://via.placeholder.com/150/FF6B6B/FFFFFF?text=T1',
    statusMessage: 'Testing Sales Tracker'
  },
  user2: {
    userId: 'U0002',
    displayName: 'Test User 2',
    pictureUrl: 'https://via.placeholder.com/150/4ECDC4/FFFFFF?text=T2',
    statusMessage: 'Sales Champion'
  },
  admin: {
    userId: 'U9999',
    displayName: 'Admin User',
    pictureUrl: 'https://via.placeholder.com/150/45B7D1/FFFFFF?text=AD',
    statusMessage: 'System Administrator'
  }
};