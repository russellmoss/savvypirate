// background/auth.js - OAuth2 Token Management

let cachedToken = null;

/**
 * Get OAuth2 token via Chrome Identity API
 * @param {boolean} interactive - Show login popup if needed
 * @returns {Promise<string>} The auth token
 */
export async function getAuthToken(interactive = true) {
    return new Promise((resolve, reject) => {
        console.log(`[AUTH] Requesting token (interactive: ${interactive})`);
        
        chrome.identity.getAuthToken({ interactive }, (token) => {
            if (chrome.runtime.lastError) {
                console.error('[AUTH] Error:', chrome.runtime.lastError.message);
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            
            if (!token) {
                console.error('[AUTH] No token received');
                reject(new Error('No token received'));
                return;
            }
            
            cachedToken = token;
            console.log('[AUTH] Token acquired successfully');
            resolve(token);
        });
    });
}

/**
 * Remove cached token to force refresh (use after 401 errors)
 * @param {string} token - The token to invalidate
 * @returns {Promise<void>}
 */
export async function removeCachedToken(token = null) {
    const tokenToRemove = token || cachedToken;
    
    if (!tokenToRemove) {
        console.log('[AUTH] No token to remove');
        return;
    }
    
    return new Promise((resolve) => {
        console.log('[AUTH] Removing cached token...');
        
        chrome.identity.removeCachedAuthToken({ token: tokenToRemove }, () => {
            if (chrome.runtime.lastError) {
                console.warn('[AUTH] Remove token warning:', chrome.runtime.lastError.message);
            }
            cachedToken = null;
            console.log('[AUTH] Token removed, will refresh on next request');
            resolve();
        });
    });
}

/**
 * Get current cached token without refresh
 * @returns {string|null}
 */
export function getCachedToken() {
    return cachedToken;
}

