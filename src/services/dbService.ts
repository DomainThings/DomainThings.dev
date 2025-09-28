import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';
import { Domain, type DomainData } from '@/types';

/**
 * Database configuration
 */
const DB_CONFIG = Object.freeze({
  name: 'domaincheck-db',
  version: 7,
  stores: {
    domains: 'domains',
    tlds: 'tlds', 
    searches: 'searches',
    dnsCache: 'dnsCache',
    settings: 'settings',
    alerts: 'alerts'
  }
} as const);

/**
 * Domain record for database storage
 */
interface DomainRecord extends DomainData {
  readonly id?: number;
  readonly tags?: readonly string[];
  readonly notes?: string;
}

/**
 * TLD record for database storage
 */
interface TldRecord {
  readonly tld: string;
  readonly isEnabled: boolean;
  readonly priority: number;
  readonly lastUpdated: number;
  readonly metadata?: {
    readonly country?: string;
    readonly type?: 'gTLD' | 'ccTLD' | 'sTLD';
    readonly description?: string;
  };
}

/**
 * Settings record for database storage
 */
interface SettingsRecord {
  readonly key: string;
  readonly value: any;
  readonly lastUpdated: number;
}

/**
 * Alert record for database storage
 */
interface AlertRecord {
  readonly id: string;
  readonly domain: string;
  readonly alertDate: string; // ISO string
  readonly reminderFrequency: 'once' | 'daily' | 'weekly';
  readonly expirationDate: string; // ISO string
  readonly createdAt: string; // ISO string
  readonly lastNotified?: string; // ISO string
}

/**
 * Database operation result
 */
interface DbResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

/**
 * Database connection instance
 */
let dbInstance: IDBPDatabase | null = null;

/**
 * Database initialization promise to prevent multiple initializations
 */
let dbInitPromise: Promise<IDBPDatabase> | null = null;

/**
 * Opens and initializes the IndexedDB database
 * @returns Promise resolving to the database instance
 */
export const getDb = async (): Promise<IDBPDatabase> => {
  // Return existing instance if available
  if (dbInstance && dbInstance.version === DB_CONFIG.version) {
    return dbInstance;
  }
  
  // Return existing initialization promise if in progress
  if (dbInitPromise) {
    return dbInitPromise;
  }
  
  // Create new initialization promise
  dbInitPromise = openDB(DB_CONFIG.name, DB_CONFIG.version, {
    upgrade(db, oldVersion, newVersion, transaction) {
      console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);
      
      // Create domains store
      if (!db.objectStoreNames.contains(DB_CONFIG.stores.domains)) {
        const domainsStore = db.createObjectStore(DB_CONFIG.stores.domains, { 
          keyPath: 'name' 
        });
        domainsStore.createIndex('availability', 'availability');
        domainsStore.createIndex('isInWatchList', 'isInWatchList');
        domainsStore.createIndex('lastChecked', 'lastChecked');
        domainsStore.createIndex('registrar', 'registrar');
      }
      
      // Create TLDs store
      if (!db.objectStoreNames.contains(DB_CONFIG.stores.tlds)) {
        const tldsStore = db.createObjectStore(DB_CONFIG.stores.tlds, { 
          keyPath: 'tld' 
        });
        tldsStore.createIndex('isEnabled', 'isEnabled');
        tldsStore.createIndex('priority', 'priority');
        tldsStore.createIndex('type', 'metadata.type');
      }
      
      // Create settings store
      if (!db.objectStoreNames.contains(DB_CONFIG.stores.settings)) {
        db.createObjectStore(DB_CONFIG.stores.settings, { 
          keyPath: 'key' 
        });
      }
      
      // Create alerts store
      if (!db.objectStoreNames.contains(DB_CONFIG.stores.alerts)) {
        const alertsStore = db.createObjectStore(DB_CONFIG.stores.alerts, { 
          keyPath: 'id' 
        });
        alertsStore.createIndex('domain', 'domain', { unique: false });
        alertsStore.createIndex('expirationDate', 'expirationDate');
      }
      
      // Migration for version 7: Remove 'enabled' field from alerts
      if (oldVersion < 7 && db.objectStoreNames.contains(DB_CONFIG.stores.alerts)) {
        const alertsStore = transaction.objectStore(DB_CONFIG.stores.alerts);
        
        // Remove old 'enabled' index if it exists
        if (alertsStore.indexNames.contains('enabled')) {
          alertsStore.deleteIndex('enabled');
        }
        
        console.log('Removed enabled index from alerts store in database migration to version 7');
      }
    },
    blocked() {
      console.warn('Database upgrade blocked by another connection');
    },
    blocking() {
      console.warn('Database connection is blocking an upgrade');
    },
    terminated() {
      console.error('Database connection was terminated');
      dbInstance = null;
      dbInitPromise = null;
    }
  });
  
  try {
    dbInstance = await dbInitPromise;
    return dbInstance;
  } catch (error) {
    dbInitPromise = null;
    throw error;
  }
};

/**
 * Handles database operation errors consistently
 * @param operation - Operation name for logging
 * @param error - Error that occurred
 * @returns Formatted error result
 */
const handleDbError = <T>(operation: string, error: any): DbResult<T> => {
  const errorMessage = error?.message ?? String(error);
  console.error(`Database ${operation} failed:`, errorMessage);
  
  return {
    success: false,
    error: `Database ${operation} failed: ${errorMessage}`
  };
};

/**
 * Saves a domain to the database
 * @param domain - Domain instance to save
 * @returns Promise resolving to operation result
 */
export const saveDomain = async (domain: Domain): Promise<DbResult<void>> => {
  try {
    const db = await getDb();
    const tx = db.transaction(DB_CONFIG.stores.domains, 'readwrite');
    const store = tx.objectStore(DB_CONFIG.stores.domains);
    
    const domainRecord: DomainRecord = {
      ...domain.toJSON(),
      lastChecked: new Date().toISOString()
    };
    
    await store.put(domainRecord);
    await tx.done;
    
    return { success: true };
  } catch (error) {
    return handleDbError('save domain', error);
  }
};

/**
 * Gets a domain from the database
 * @param name - Domain name to retrieve
 * @returns Promise resolving to domain result
 */
export const getDomain = async (name: string): Promise<DbResult<Domain | null>> => {
  try {
    const db = await getDb();
    const tx = db.transaction(DB_CONFIG.stores.domains, 'readonly');
    const store = tx.objectStore(DB_CONFIG.stores.domains);
    
    const record = await store.get(name);
    await tx.done;
    
    if (!record) {
      return { success: true, data: null };
    }
    
    const domain = Domain.fromJSON(record);
    return { success: true, data: domain };
  } catch (error) {
    return handleDbError('get domain', error);
  }
};

/**
 * Gets all domains from the database with optional filtering
 * @param filter - Optional filter function
 * @returns Promise resolving to domains result
 */
export const getAllDomains = async (
  filter?: (domain: Domain) => boolean
): Promise<DbResult<Domain[]>> => {
  try {
    const db = await getDb();
    const tx = db.transaction(DB_CONFIG.stores.domains, 'readonly');
    const store = tx.objectStore(DB_CONFIG.stores.domains);
    
    const records = await store.getAll();
    await tx.done;
    
    let domains = records.map(record => Domain.fromJSON(record));
    
    if (filter) {
      domains = domains.filter(filter);
    }
    
    return { success: true, data: domains };
  } catch (error) {
    return handleDbError('get all domains', error);
  }
};

/**
 * Gets domains in watch list
 * @returns Promise resolving to watch list domains
 */
export const getWatchListDomains = async (): Promise<DbResult<Domain[]>> => {
  try {
    const db = await getDb();
    const tx = db.transaction(DB_CONFIG.stores.domains, 'readonly');
    const store = tx.objectStore(DB_CONFIG.stores.domains);
    const index = store.index('isInWatchList');
    
    const records = await index.getAll(IDBKeyRange.only(true));
    await tx.done;
    
    const domains = records.map(record => Domain.fromJSON(record));
    
    return { success: true, data: domains };
  } catch (error) {
    return handleDbError('get watch list domains', error);
  }
};

/**
 * Removes a domain from the database
 * @param name - Domain name to remove
 * @returns Promise resolving to operation result
 */
export const removeDomain = async (name: string): Promise<DbResult<boolean>> => {
  try {
    const db = await getDb();
    const tx = db.transaction(DB_CONFIG.stores.domains, 'readwrite');
    const store = tx.objectStore(DB_CONFIG.stores.domains);
    
    const existingRecord = await store.get(name);
    if (!existingRecord) {
      return { success: true, data: false };
    }
    
    await store.delete(name);
    await tx.done;
    
    return { success: true, data: true };
  } catch (error) {
    return handleDbError('remove domain', error);
  }
};

/**
 * Saves TLD data to the database
 * @param tlds - Array of TLD records to save
 * @returns Promise resolving to operation result
 */
export const saveTlds = async (tlds: TldRecord[]): Promise<DbResult<void>> => {
  try {
    const db = await getDb();
    const tx = db.transaction(DB_CONFIG.stores.tlds, 'readwrite');
    const store = tx.objectStore(DB_CONFIG.stores.tlds);
    
    // Clear existing TLDs and add new ones
    await store.clear();
    
    for (const tld of tlds) {
      await store.put(tld);
    }
    
    await tx.done;
    
    return { success: true };
  } catch (error) {
    return handleDbError('save TLDs', error);
  }
};

/**
 * Gets all TLD data from the database
 * @returns Promise resolving to TLD records result
 */
export const getTlds = async (): Promise<DbResult<TldRecord[]>> => {
  try {
    const db = await getDb();
    const tx = db.transaction(DB_CONFIG.stores.tlds, 'readonly');
    const store = tx.objectStore(DB_CONFIG.stores.tlds);
    
    const records = await store.getAll();
    await tx.done;
    
    return { success: true, data: records };
  } catch (error) {
    return handleDbError('get TLDs', error);
  }
};

/**
 * Saves a setting to the database
 * @param key - Setting key
 * @param value - Setting value
 * @returns Promise resolving to operation result
 */
export const saveSetting = async (key: string, value: any): Promise<DbResult<void>> => {
  try {
    const db = await getDb();
    const tx = db.transaction(DB_CONFIG.stores.settings, 'readwrite');
    const store = tx.objectStore(DB_CONFIG.stores.settings);
    
    const record: SettingsRecord = {
      key,
      value,
      lastUpdated: Date.now()
    };
    
    await store.put(record);
    await tx.done;
    
    return { success: true };
  } catch (error) {
    return handleDbError('save setting', error);
  }
};

/**
 * Gets a setting from the database
 * @param key - Setting key
 * @param defaultValue - Default value if setting not found
 * @returns Promise resolving to setting value result
 */
export const getSetting = async <T>(
  key: string, 
  defaultValue?: T
): Promise<DbResult<T>> => {
  try {
    const db = await getDb();
    const tx = db.transaction(DB_CONFIG.stores.settings, 'readonly');
    const store = tx.objectStore(DB_CONFIG.stores.settings);
    
    const record = await store.get(key);
    await tx.done;
    
    const value = record?.value ?? defaultValue;
    
    return { success: true, data: value };
  } catch (error) {
    return handleDbError('get setting', error);
  }
};

/**
 * Saves an alert to the database
 * @param alert - Alert record to save
 * @returns Promise resolving to operation result
 */
export const saveAlert = async (alert: AlertRecord): Promise<DbResult<void>> => {
  try {
    const db = await getDb();
    const tx = db.transaction(DB_CONFIG.stores.alerts, 'readwrite');
    const store = tx.objectStore(DB_CONFIG.stores.alerts);
    
    await store.put(alert);
    await tx.done;
    
    return { success: true };
  } catch (error) {
    return handleDbError('save alert', error);
  }
};

/**
 * Gets an alert from the database by ID
 * @param id - Alert ID to retrieve
 * @returns Promise resolving to alert result
 */
export const getAlert = async (id: string): Promise<DbResult<AlertRecord | null>> => {
  try {
    const db = await getDb();
    const tx = db.transaction(DB_CONFIG.stores.alerts, 'readonly');
    const store = tx.objectStore(DB_CONFIG.stores.alerts);
    
    const record = await store.get(id);
    await tx.done;
    
    return { success: true, data: record || null };
  } catch (error) {
    return handleDbError('get alert', error);
  }
};

/**
 * Gets an alert from the database by domain name
 * @param domain - Domain name to search for
 * @returns Promise resolving to alert result
 */
export const getAlertByDomain = async (domain: string): Promise<DbResult<AlertRecord | null>> => {
  try {
    const db = await getDb();
    const tx = db.transaction(DB_CONFIG.stores.alerts, 'readonly');
    const store = tx.objectStore(DB_CONFIG.stores.alerts);
    const index = store.index('domain');
    
    const record = await index.get(domain);
    await tx.done;
    
    return { success: true, data: record || null };
  } catch (error) {
    return handleDbError('get alert by domain', error);
  }
};

/**
 * Gets all alerts from the database for a specific domain
 * @param domain - Domain name to search for
 * @returns Promise resolving to alerts result
 */
export const getAllAlertsByDomain = async (domain: string): Promise<DbResult<AlertRecord[]>> => {
  try {
    const db = await getDb();
    const tx = db.transaction(DB_CONFIG.stores.alerts, 'readonly');
    const store = tx.objectStore(DB_CONFIG.stores.alerts);
    const index = store.index('domain');
    
    const records = await index.getAll(domain);
    await tx.done;
    
    return { success: true, data: records };
  } catch (error) {
    return handleDbError('get all alerts by domain', error);
  }
};

/**
 * Gets all alerts from the database with optional filtering
 * @param filter - Optional filter function
 * @returns Promise resolving to alerts result
 */
export const getAllAlerts = async (
  filter?: (alert: AlertRecord) => boolean
): Promise<DbResult<AlertRecord[]>> => {
  try {
    const db = await getDb();
    const tx = db.transaction(DB_CONFIG.stores.alerts, 'readonly');
    const store = tx.objectStore(DB_CONFIG.stores.alerts);
    
    const records = await store.getAll();
    await tx.done;
    
    let alerts = records;
    
    if (filter) {
      alerts = alerts.filter(filter);
    }
    
    return { success: true, data: alerts };
  } catch (error) {
    return handleDbError('get all alerts', error);
  }
};



/**
 * Removes an alert from the database by ID
 * @param id - Alert ID to remove
 * @returns Promise resolving to operation result
 */
export const removeAlert = async (id: string): Promise<DbResult<boolean>> => {
  try {
    const db = await getDb();
    const tx = db.transaction(DB_CONFIG.stores.alerts, 'readwrite');
    const store = tx.objectStore(DB_CONFIG.stores.alerts);
    
    const existingRecord = await store.get(id);
    if (!existingRecord) {
      return { success: true, data: false };
    }
    
    await store.delete(id);
    await tx.done;
    
    return { success: true, data: true };
  } catch (error) {
    return handleDbError('remove alert', error);
  }
};

/**
 * Removes alerts by domain name
 * @param domain - Domain name to remove alerts for
 * @returns Promise resolving to operation result
 */
export const removeAlertsByDomain = async (domain: string): Promise<DbResult<number>> => {
  try {
    const db = await getDb();
    const tx = db.transaction(DB_CONFIG.stores.alerts, 'readwrite');
    const store = tx.objectStore(DB_CONFIG.stores.alerts);
    const index = store.index('domain');
    
    let deletedCount = 0;
    const keys = await index.getAllKeys(domain);
    
    for (const key of keys) {
      await store.delete(key);
      deletedCount++;
    }
    
    await tx.done;
    
    return { success: true, data: deletedCount };
  } catch (error) {
    return handleDbError('remove alerts by domain', error);
  }
};

/**
 * Updates the last notified timestamp for an alert
 * @param id - Alert ID
 * @param timestamp - Notification timestamp (ISO string)
 * @returns Promise resolving to operation result
 */
export const updateAlertLastNotified = async (id: string, timestamp: string): Promise<DbResult<void>> => {
  try {
    const db = await getDb();
    const tx = db.transaction(DB_CONFIG.stores.alerts, 'readwrite');
    const store = tx.objectStore(DB_CONFIG.stores.alerts);
    
    const record = await store.get(id);
    if (!record) {
      return { success: false, error: 'Alert not found' };
    }
    
    const updatedRecord: AlertRecord = {
      ...record,
      lastNotified: timestamp
    };
    
    await store.put(updatedRecord);
    await tx.done;
    
    return { success: true };
  } catch (error) {
    return handleDbError('update alert last notified', error);
  }
};

/**
 * Clears all data from the database
 * @returns Promise resolving to operation result
 */
export const clearAllData = async (): Promise<DbResult<void>> => {
  try {
    const db = await getDb();
    const tx = db.transaction([
      DB_CONFIG.stores.domains,
      DB_CONFIG.stores.tlds,
      DB_CONFIG.stores.settings,
      DB_CONFIG.stores.alerts
    ], 'readwrite');
    
    await Promise.all([
      tx.objectStore(DB_CONFIG.stores.domains).clear(),
      tx.objectStore(DB_CONFIG.stores.tlds).clear(),
      tx.objectStore(DB_CONFIG.stores.settings).clear(),
      tx.objectStore(DB_CONFIG.stores.alerts).clear()
    ]);
    
    await tx.done;
    
    return { success: true };
  } catch (error) {
    return handleDbError('clear all data', error);
  }
};

/**
 * Gets database statistics
 * @returns Promise resolving to database statistics
 */
export const getDbStats = async (): Promise<DbResult<{
  domainCount: number;
  tldCount: number;
  settingCount: number;
  alertCount: number;
  watchListCount: number;
  dbSize: string;
}>> => {
  try {
    const db = await getDb();
    
    const [domainsCount, tldsCount, settingsCount, alertsCount, watchListResult] = await Promise.all([
      db.count(DB_CONFIG.stores.domains),
      db.count(DB_CONFIG.stores.tlds),
      db.count(DB_CONFIG.stores.settings),
      db.count(DB_CONFIG.stores.alerts),
      getWatchListDomains()
    ]);
    
    const watchListCount = watchListResult.success ? watchListResult.data?.length ?? 0 : 0;
    
    // Estimate database size (rough approximation)
    const dbSize = '~' + Math.round((domainsCount * 500 + tldsCount * 100 + settingsCount * 50 + alertsCount * 200) / 1024) + 'KB';
    
    return {
      success: true,
      data: {
        domainCount: domainsCount,
        tldCount: tldsCount,
        settingCount: settingsCount,
        alertCount: alertsCount,
        watchListCount,
        dbSize
      }
    };
  } catch (error) {
    return handleDbError('get database stats', error);
  }
};

/**
 * Closes the database connection
 */
export const closeDb = (): void => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbInitPromise = null;
  }
};

/**
 * Forces a manual migration from legacy database
 * @returns Promise resolving to migration result
 */
// Export types for external use
export type { DomainRecord, TldRecord, SettingsRecord, AlertRecord, DbResult };
