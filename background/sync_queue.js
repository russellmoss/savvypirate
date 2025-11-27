// background/sync_queue.js - Resilient Local-First Sync Queue

import { appendRows } from './sheets_api.js';

const STORAGE_KEYS = {
    QUEUE: 'syncQueue',
    FAILED: 'failedRows'
};

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2000; // 2 seconds, doubles each retry

/**
 * Get current queue from storage
 */
async function getQueue() {
    return new Promise((resolve) => {
        chrome.storage.local.get(STORAGE_KEYS.QUEUE, (result) => {
            resolve(result[STORAGE_KEYS.QUEUE] || []);
        });
    });
}

/**
 * Save queue to storage
 */
async function saveQueue(queue) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [STORAGE_KEYS.QUEUE]: queue }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

/**
 * Get failed rows from storage
 */
async function getFailedRowsFromStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.get(STORAGE_KEYS.FAILED, (result) => {
            resolve(result[STORAGE_KEYS.FAILED] || []);
        });
    });
}

/**
 * Save failed rows to storage
 */
async function saveFailedRows(rows) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [STORAGE_KEYS.FAILED]: rows }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

/**
 * Add rows to the sync queue (LOCAL FIRST - data is safe immediately)
 * @param {Array<Array>} rows - Data rows to sync
 * @param {string} spreadsheetId - Target spreadsheet
 * @param {string} tabName - Tab name to write to (default: 'Sheet1')
 * @returns {Promise<void>}
 */
export async function addToQueue(rows, spreadsheetId, tabName = 'Sheet1') {
    if (!rows || rows.length === 0) return;
    
    const queue = await getQueue();
    
    const queueItem = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        spreadsheetId,
        tabName,
        rows,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        lastAttempt: null
    };
    
    queue.push(queueItem);
    await saveQueue(queue);
    
    console.log(`[QUEUE] Added ${rows.length} rows to queue (tab: ${tabName}). Queue size: ${queue.length}`);
    
    // Trigger immediate processing
    processQueue();
}

/**
 * Process the sync queue - attempt to send pending items to Sheets
 * @returns {Promise<{synced: number, failed: number, pending: number}>}
 */
export async function processQueue() {
    const queue = await getQueue();
    
    if (queue.length === 0) {
        console.log('[QUEUE] Queue empty, nothing to process');
        return { synced: 0, failed: 0, pending: 0 };
    }
    
    console.log(`[QUEUE] Processing ${queue.length} items...`);
    
    let synced = 0;
    let failed = 0;
    const remainingQueue = [];
    const newFailedRows = [];
    
    for (const item of queue) {
        try {
            // Attempt to sync (use tabName from queue item, default to Sheet1)
            const tabName = item.tabName || 'Sheet1';
            await appendRows(item.spreadsheetId, item.rows, false, tabName);
            synced += item.rows.length;
            console.log(`[QUEUE] ✅ Synced item ${item.id} (${item.rows.length} rows to tab: ${tabName})`);
            
        } catch (error) {
            console.warn(`[QUEUE] ❌ Sync failed for ${item.id}:`, error.message);
            
            item.retryCount++;
            item.lastAttempt = new Date().toISOString();
            item.lastError = error.message;
            
            if (item.retryCount >= MAX_RETRIES) {
                // Move to failed queue
                console.error(`[QUEUE] Item ${item.id} exceeded max retries, moving to failed`);
                newFailedRows.push({
                    ...item,
                    failedAt: new Date().toISOString()
                });
                failed += item.rows.length;
            } else {
                // Keep in queue for retry
                remainingQueue.push(item);
                console.log(`[QUEUE] Item ${item.id} will retry (attempt ${item.retryCount}/${MAX_RETRIES})`);
            }
        }
    }
    
    // Save updated queue
    await saveQueue(remainingQueue);
    
    // Save any new failed rows
    if (newFailedRows.length > 0) {
        const existingFailed = await getFailedRowsFromStorage();
        await saveFailedRows([...existingFailed, ...newFailedRows]);
    }
    
    const result = {
        synced,
        failed,
        pending: remainingQueue.length
    };
    
    console.log(`[QUEUE] Process complete:`, result);
    return result;
}

/**
 * Get queue status for UI display
 * @returns {Promise<{pending: number, pendingRows: number, failed: number, failedRows: number}>}
 */
export async function getQueueStatus() {
    const queue = await getQueue();
    const failedItems = await getFailedRowsFromStorage();
    
    const pendingRows = queue.reduce((sum, item) => sum + item.rows.length, 0);
    const failedRowCount = failedItems.reduce((sum, item) => sum + item.rows.length, 0);
    
    return {
        pending: queue.length,
        pendingRows,
        failed: failedItems.length,
        failedRows: failedRowCount
    };
}

/**
 * Get all failed rows for CSV export
 * @returns {Promise<Array<Array>>}
 */
export async function getFailedRows() {
    const failedItems = await getFailedRowsFromStorage();
    
    // Flatten all rows from failed items
    const allRows = [];
    for (const item of failedItems) {
        allRows.push(...item.rows);
    }
    
    return allRows;
}

/**
 * Clear failed rows after successful export
 * @returns {Promise<void>}
 */
export async function clearFailedRows() {
    await saveFailedRows([]);
    console.log('[QUEUE] Cleared failed rows');
}

/**
 * Force retry all failed items (move back to main queue)
 * @returns {Promise<number>} Number of items moved back
 */
export async function retryFailedItems() {
    const failedItems = await getFailedRowsFromStorage();
    
    if (failedItems.length === 0) return 0;
    
    // Reset retry counts and move to main queue
    const queue = await getQueue();
    for (const item of failedItems) {
        item.retryCount = 0;
        item.lastError = null;
        delete item.failedAt;
        queue.push(item);
    }
    
    await saveQueue(queue);
    await saveFailedRows([]);
    
    console.log(`[QUEUE] Moved ${failedItems.length} items back to queue for retry`);
    return failedItems.length;
}

