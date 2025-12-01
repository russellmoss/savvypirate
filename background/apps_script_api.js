// background/apps_script_api.js - Apps Script Web App Integration

/**
 * Call an Apps Script function via Web App deployment
 * @param {string} webAppUrl - The deployed Web App URL (ends in /exec)
 * @param {string} action - Action to perform ('cleanTab' or 'enrichTab')
 * @param {string} tabName - Target tab name
 * @param {number} retries - Number of retry attempts (default: 3)
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
async function callAppsScriptWebApp(webAppUrl, action, tabName, retries = 3) {
  console.log(`[APPS_SCRIPT] Calling Web App: ${action} on tab "${tabName}"`);
  console.log(`[APPS_SCRIPT] Web App URL: ${webAppUrl}`);
  
  // Ensure URL ends with /exec
  const url = webAppUrl.endsWith('/exec') ? webAppUrl : `${webAppUrl.replace(/\/$/, '')}/exec`;
  
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[APPS_SCRIPT] Attempt ${attempt}/${retries}: Calling ${url}`);
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
      
      // STRATEGY: Try GET first (most reliable), fallback to POST with JSON
      // GET uses doGet which works perfectly (tested locally)
      // POST with JSON might work better than form data (avoids auto-parsing issue)
      
      let response;
      let useGet = true; // Prefer GET, but can fallback to POST
      
      if (useGet) {
        // Use GET with query parameters (most reliable)
        const params = new URLSearchParams();
        params.append('action', action);
        params.append('tabName', tabName);
        
        const getUrl = `${url}?${params.toString()}`;
        console.log(`[APPS_SCRIPT] Using GET: ${getUrl}`);
        
        response = await fetch(getUrl, {
          method: 'GET',
          signal: controller.signal,
          mode: 'cors'
        });
      } else {
        // Fallback: POST with JSON (might work better than form data)
        const jsonBody = JSON.stringify({ action, tabName });
        console.log(`[APPS_SCRIPT] Using POST with JSON: ${jsonBody}`);
        
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: jsonBody,
          signal: controller.signal,
          mode: 'cors'
        });
      }
      
      clearTimeout(timeoutId);
      
      console.log(`[APPS_SCRIPT] Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[APPS_SCRIPT] HTTP Error ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText || errorText.substring(0, 200)}`);
      }
      
      const responseText = await response.text();
      console.log(`[APPS_SCRIPT] Response body:`, responseText.substring(0, 500));
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[APPS_SCRIPT] Failed to parse JSON response:`, parseError);
        throw new Error(`Invalid JSON response from Apps Script: ${responseText.substring(0, 200)}`);
      }
      
      if (!result.success) {
        console.error(`[APPS_SCRIPT] Apps Script returned error:`, result.error);
        throw new Error(result.error || 'Unknown error from Apps Script');
      }
      
      console.log(`[APPS_SCRIPT] ✅ ${action} completed: ${result.message || 'Success'}`);
      if (result.details) {
        console.log(`[APPS_SCRIPT] Details:`, result.details);
      }
      return result;
      
    } catch (error) {
      lastError = error;
      const errorDetails = {
        message: error.message,
        name: error.name,
        stack: error.stack?.substring(0, 500)
      };
      console.error(`[APPS_SCRIPT] Attempt ${attempt}/${retries} failed for ${action}:`, errorDetails);
      
      // Check if it's a CORS error specifically
      if (error.message.includes('CORS') || error.message.includes('fetch')) {
        console.error(`[APPS_SCRIPT] ⚠️ CORS Error detected. This may indicate:`);
        console.error(`[APPS_SCRIPT]   1. Web App not deployed correctly`);
        console.error(`[APPS_SCRIPT]   2. Web App URL is incorrect`);
        console.error(`[APPS_SCRIPT]   3. Web App access settings need adjustment`);
      }
      
      // If this was the last attempt, return failure with detailed error
      if (attempt === retries) {
        let errorMessage = error.message || 'Request failed after retries';
        
        // Add helpful context for CORS errors
        if (error.message.includes('CORS') || error.message.includes('fetch')) {
          errorMessage = `CORS Error: ${errorMessage}. Please verify Web App URL and deployment settings.`;
        }
        
        return {
          success: false,
          error: errorMessage,
          details: errorDetails
        };
      }
      
      // Exponential backoff: wait 2s, 4s, 8s before retry
      const delay = 2000 * Math.pow(2, attempt - 1);
      console.log(`[APPS_SCRIPT] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Should never reach here, but just in case
  return {
    success: false,
    error: lastError?.message || 'Request failed after retries'
  };
}

/**
 * Run Janitor AI on a specific tab
 * @param {string} webAppUrl - Apps Script Web App URL (from workbook.webAppUrl)
 * @param {string} tabName - Tab to clean
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function runJanitorAI(webAppUrl, tabName) {
  if (!webAppUrl) {
    return {
      success: false,
      error: 'No Web App URL configured for this workbook'
    };
  }
  
  return await callAppsScriptWebApp(webAppUrl, 'cleanTab', tabName);
}

/**
 * Run BigQuery Enrichment on a specific tab
 * @param {string} webAppUrl - Apps Script Web App URL (from workbook.webAppUrl)
 * @param {string} tabName - Tab to enrich
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function runBigQueryEnrichment(webAppUrl, tabName) {
  if (!webAppUrl) {
    return {
      success: false,
      error: 'No Web App URL configured for this workbook'
    };
  }
  
  return await callAppsScriptWebApp(webAppUrl, 'enrichTab', tabName);
}

