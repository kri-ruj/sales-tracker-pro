import liff from '@line/liff';

const LIFF_ID = import.meta.env.VITE_LIFF_ID || '2007552096-wrG1aV9p';

export async function initializeLiff(): Promise<void> {
  try {
    await liff.init({ liffId: LIFF_ID });
    console.log('LIFF initialized:', {
      isInClient: liff.isInClient(),
      isLoggedIn: liff.isLoggedIn(),
      language: liff.getLanguage(),
      version: liff.getVersion(),
    });
  } catch (error) {
    console.error('LIFF initialization failed:', error);
    throw error;
  }
}

export function isInLiffClient(): boolean {
  return liff.isInClient();
}

export function isLoggedIn(): boolean {
  return liff.isLoggedIn();
}

export async function login(redirectUri?: string): Promise<void> {
  liff.login({ redirectUri });
}

export function logout(): void {
  liff.logout();
}

export function getAccessToken(): string | null {
  return liff.getAccessToken();
}

export async function getProfile(): Promise<{
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
} | null> {
  try {
    if (!isLoggedIn()) {
      return null;
    }
    return await liff.getProfile();
  } catch (error) {
    console.error('Failed to get LIFF profile:', error);
    return null;
  }
}

export function getLanguage(): string {
  return liff.getLanguage();
}

export function getVersion(): string {
  return liff.getVersion();
}

export function closeWindow(): void {
  liff.closeWindow();
}

export async function sendMessages(messages: any[]): Promise<void> {
  if (!liff.isInClient()) {
    throw new Error('This feature is only available in LIFF client');
  }
  
  try {
    await liff.sendMessages(messages);
  } catch (error) {
    console.error('Failed to send messages:', error);
    throw error;
  }
}

export async function shareTargetPicker(messages: any[]): Promise<void> {
  if (!liff.isInClient()) {
    throw new Error('This feature is only available in LIFF client');
  }
  
  try {
    await liff.shareTargetPicker(messages);
  } catch (error) {
    console.error('Failed to share:', error);
    throw error;
  }
}

export function scanCode(): Promise<string | null> {
  if (!liff.isInClient()) {
    throw new Error('This feature is only available in LIFF client');
  }
  
  return new Promise((resolve, reject) => {
    liff.scanCodeV2()
      .then(result => {
        resolve(result.value);
      })
      .catch(error => {
        console.error('Failed to scan code:', error);
        reject(error);
      });
  });
}

// Export liff instance for advanced usage
export { liff };