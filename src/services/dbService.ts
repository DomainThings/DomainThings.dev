import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';
import { Domain, type DomainData } from '@/types';

/**
 * Database configuration
 */
const DB_CONFIG = {
  name: 'domaincheck-db',
  version: 4,
  stores: {
    domains: 'domains',
    tlds: 'tlds',
    settings: 'settings'
  },
  // Legacy database for migration
  legacy: {
    name: 'database',
    version: 3
  }
} as const;

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
 * Database operation result
 */
interface DbResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

/**
 * Migrates data from legacy database to new structure
 * @returns Promise resolving to migration result
 */
const migrateLegacyData = async (): Promise<{ success: boolean; migratedCount: number; error?: string }> => {
  try {
    console.log('🔄 Checking for legacy database to migrate...');
    
    // Try to open legacy database
    let legacyDb: IDBPDatabase;
    try {
      legacyDb = await openDB(DB_CONFIG.legacy.name, DB_CONFIG.legacy.version);
    } catch (error) {
      // Legacy database doesn't exist, nothing to migrate
      console.log('✅ No legacy database found, migration not needed');
      return { success: true, migratedCount: 0 };
    }
    
    // Check if legacy database has any data
    const legacyDomainCount = await legacyDb.count('domains').catch(() => 0);
    const legacyTldCount = await legacyDb.count('tlds').catch(() => 0);
    
    if (legacyDomainCount === 0 && legacyTldCount === 0) {
      console.log('✅ Legacy database exists but is empty, cleaning up');
      legacyDb.close();
      // Delete empty legacy database
      indexedDB.deleteDatabase(DB_CONFIG.legacy.name);
      return { success: true, migratedCount: 0 };
    }
    
    console.log(`📦 Found legacy data: ${legacyDomainCount} domains, ${legacyTldCount} TLDs`);
    
    // Open new database
    const newDb = await getDb();
    let migratedCount = 0;
    
    // Migrate domains
    if (legacyDomainCount > 0) {
      try {
        const legacyDomains = await legacyDb.getAll('domains');
        const newTx = newDb.transaction(DB_CONFIG.stores.domains, 'readwrite');
        const newStore = newTx.objectStore(DB_CONFIG.stores.domains);
        
        for (const legacyDomain of legacyDomains) {
          // Transform legacy domain to new structure
          const migratedDomain: DomainRecord = {
            name: legacyDomain.name || '',
            availability: legacyDomain.availability,
            isInWatchList: legacyDomain.isInWatchList || false,
            isChecking: false, // Reset checking state
            creationDate: legacyDomain.creationDate,
            expirationDate: legacyDomain.expirationDate,
            registrar: legacyDomain.registrar,
            lastChecked: legacyDomain.lastChecked || new Date().toISOString()
          };
          
          await newStore.put(migratedDomain);
          migratedCount++;
        }
        
        await newTx.done;
        console.log(`✅ Migrated ${legacyDomains.length} domains`);
      } catch (error) {
        console.warn('⚠️ Error migrating domains:', error);
      }
    }
    
    // Migrate TLDs
    if (legacyTldCount > 0) {
      try {
        const legacyTlds = await legacyDb.getAll('tlds');
        const newTx = newDb.transaction(DB_CONFIG.stores.tlds, 'readwrite');
        const newStore = newTx.objectStore(DB_CONFIG.stores.tlds);
        
        for (const legacyTld of legacyTlds) {
          // Transform legacy TLD to new structure
          const migratedTld: TldRecord = {
            tld: legacyTld.tld || '',
            isEnabled: legacyTld.isEnabled !== false, // Default to enabled
            priority: legacyTld.priority || 0,
            lastUpdated: Date.now(),
            metadata: {
              type: legacyTld.type || (legacyTld.tld?.length === 2 ? 'ccTLD' : 'gTLD'),
              country: legacyTld.country,
              description: legacyTld.description
            }
          };
          
          await newStore.put(migratedTld);
          migratedCount++;
        }
        
        await newTx.done;
        console.log(`✅ Migrated ${legacyTlds.length} TLDs`);
      } catch (error) {
        console.warn('⚠️ Error migrating TLDs:', error);
      }
    }
    
    // Close legacy database and mark migration as complete
    legacyDb.close();
    
    // Save migration completion flag
    await saveSetting('migration_completed', {
      version: DB_CONFIG.version,
      timestamp: Date.now(),
      migratedCount
    });
    
    console.log(`🎉 Migration completed successfully! Migrated ${migratedCount} records`);
    
    // Schedule legacy database cleanup after successful migration
    setTimeout(() => {
      try {
        indexedDB.deleteDatabase(DB_CONFIG.legacy.name);
        console.log('🗑️ Legacy database cleaned up');
      } catch (error) {
        console.warn('⚠️ Could not delete legacy database:', error);
      }
    }, 5000); // Wait 5 seconds to ensure everything is stable
    
    return { success: true, migratedCount };
    
  } catch (error: any) {
    const errorMessage = error?.message ?? String(error);
    console.error('❌ Migration failed:', errorMessage);
    return { 
      success: false, 
      migratedCount: 0, 
      error: errorMessage 
    };
  }
};

/**
 * Checks if migration has already been completed
 * @returns Promise resolving to migration status
 */
const isMigrationCompleted = async (): Promise<boolean> => {
  try {
    const result = await getSetting('migration_completed');
    const migrationData = result.data as { version?: number; timestamp?: number; migratedCount?: number } | undefined;
    return result.success && migrationData?.version === DB_CONFIG.version;
  } catch {
    return false;
  }
};

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
      
      // Migration logic for existing data
      if (oldVersion < 4) {
        // Add any necessary data migrations here
        console.log('Migrating data to new schema...');
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
    
    // Check and perform legacy migration if needed
    const migrationCompleted = await isMigrationCompleted();
    if (!migrationCompleted) {
      console.log('🔄 Starting legacy data migration...');
      const migrationResult = await migrateLegacyData();
      
      if (migrationResult.success && migrationResult.migratedCount > 0) {
        console.log(`✅ Successfully migrated ${migrationResult.migratedCount} records from legacy database`);
      } else if (migrationResult.error) {
        console.warn('⚠️ Migration encountered issues:', migrationResult.error);
      }
    }
    
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
 * Clears all data from the database
 * @returns Promise resolving to operation result
 */
export const clearAllData = async (): Promise<DbResult<void>> => {
  try {
    const db = await getDb();
    const tx = db.transaction([
      DB_CONFIG.stores.domains,
      DB_CONFIG.stores.tlds,
      DB_CONFIG.stores.settings
    ], 'readwrite');
    
    await Promise.all([
      tx.objectStore(DB_CONFIG.stores.domains).clear(),
      tx.objectStore(DB_CONFIG.stores.tlds).clear(),
      tx.objectStore(DB_CONFIG.stores.settings).clear()
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
  watchListCount: number;
  dbSize: string;
}>> => {
  try {
    const db = await getDb();
    
    const [domainsCount, tldsCount, settingsCount, watchListResult] = await Promise.all([
      db.count(DB_CONFIG.stores.domains),
      db.count(DB_CONFIG.stores.tlds),
      db.count(DB_CONFIG.stores.settings),
      getWatchListDomains()
    ]);
    
    const watchListCount = watchListResult.success ? watchListResult.data?.length ?? 0 : 0;
    
    // Estimate database size (rough approximation)
    const dbSize = '~' + Math.round((domainsCount * 500 + tldsCount * 100 + settingsCount * 50) / 1024) + 'KB';
    
    return {
      success: true,
      data: {
        domainCount: domainsCount,
        tldCount: tldsCount,
        settingCount: settingsCount,
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
export const forceMigration = async (): Promise<DbResult<{ migratedCount: number }>> => {
  try {
    const migrationResult = await migrateLegacyData();
    
    if (migrationResult.success) {
      return {
        success: true,
        data: { migratedCount: migrationResult.migratedCount }
      };
    } else {
      return {
        success: false,
        error: migrationResult.error || 'Migration failed'
      };
    }
  } catch (error) {
    return handleDbError('force migration', error);
  }
};

/**
 * Gets migration status information
 * @returns Promise resolving to migration status
 */
export const getMigrationStatus = async (): Promise<DbResult<{
  isCompleted: boolean;
  migrationData?: {
    version: number;
    timestamp: number;
    migratedCount: number;
  };
  legacyDbExists: boolean;
}>> => {
  try {
    const isCompleted = await isMigrationCompleted();
    const migrationSetting = await getSetting('migration_completed');
    
    // Check if legacy database exists
    let legacyDbExists = false;
    try {
      const legacyDb = await openDB(DB_CONFIG.legacy.name, DB_CONFIG.legacy.version);
      legacyDbExists = true;
      legacyDb.close();
    } catch {
      legacyDbExists = false;
    }
    
    return {
      success: true,
      data: {
        isCompleted,
        migrationData: migrationSetting.success ? migrationSetting.data as any : undefined,
        legacyDbExists
      }
    };
  } catch (error) {
    return handleDbError('get migration status', error);
  }
};

/**
 * Cleans up legacy database (only if migration is completed)
 * @returns Promise resolving to cleanup result
 */
export const cleanupLegacyDatabase = async (): Promise<DbResult<boolean>> => {
  try {
    const isCompleted = await isMigrationCompleted();
    
    if (!isCompleted) {
      return {
        success: false,
        error: 'Migration not completed, cannot cleanup legacy database'
      };
    }
    
    try {
      indexedDB.deleteDatabase(DB_CONFIG.legacy.name);
      console.log('🗑️ Legacy database cleaned up successfully');
      return { success: true, data: true };
    } catch (error) {
      console.warn('⚠️ Could not delete legacy database:', error);
      return {
        success: false,
        error: 'Failed to delete legacy database'
      };
    }
  } catch (error) {
    return handleDbError('cleanup legacy database', error);
  }
};

// Export types for external use
export type { DomainRecord, TldRecord, SettingsRecord, DbResult };
