/**
 * Service de gestion des alertes de notification PWA pour les domaines
 */
import * as db from './dbService';

export interface AlertSettings {
  id: string;
  domain: string;
  enabled: boolean;
  daysBeforeExpiration: number;
  reminderFrequency: 'once' | 'daily' | 'weekly';
  expirationDate: Date;
  createdAt: Date;
  lastNotified?: Date;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag: string;
  data?: any;
}

class AlertService {
  private static instance: AlertService;
  private alerts: Map<string, AlertSettings> = new Map();
  private worker: ServiceWorker | null = null;

  private constructor() {
    this.initializeServiceWorker();
    this.loadAlertsFromDatabase();
  }

  static getInstance(): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService();
    }
    return AlertService.instance;
  }

  /**
   * Initialise le service worker pour les notifications
   */
  private async initializeServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        this.worker = registration.active;
      } catch (error) {
        console.error('Erreur lors de l\'initialisation du service worker:', error);
      }
    }
  }

  /**
   * Vérifie si les notifications sont supportées et autorisées
   */
  async checkNotificationSupport(): Promise<{ supported: boolean; permission: NotificationPermission }> {
    const supported = 'Notification' in window;
    const permission = supported ? Notification.permission : 'denied';
    
    return { supported, permission };
  }

  /**
   * Demande l'autorisation pour les notifications
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  /**
   * Crée ou met à jour une alerte
   */
  async saveAlert(alertSettings: Omit<AlertSettings, 'id' | 'createdAt'>): Promise<AlertSettings> {
    const id = `alert_${alertSettings.domain}_${Date.now()}`;
    const alert: AlertSettings = {
      ...alertSettings,
      id,
      createdAt: new Date()
    };

    // Supprimer l'ancienne alerte pour ce domaine si elle existe
    await this.removeAlertByDomain(alertSettings.domain);
    
    // Sauvegarder en base
    const alertRecord: db.AlertRecord = {
      ...alert,
      expirationDate: alert.expirationDate.toISOString(),
      createdAt: alert.createdAt.toISOString(),
      lastNotified: alert.lastNotified?.toISOString()
    };
    
    const result = await db.saveAlert(alertRecord);
    if (!result.success) {
      throw new Error(result.error || 'Erreur lors de la sauvegarde de l\'alerte');
    }
    
    this.alerts.set(id, alert);
    
    // Synchroniser avec le Service Worker pour les notifications en arrière-plan
    await this.syncAlertsToServiceWorker();
    
    return alert;
  }

  /**
   * Supprime une alerte par ID
   */
  async removeAlert(alertId: string): Promise<boolean> {
    const result = await db.removeAlert(alertId);
    if (result.success && result.data) {
      this.alerts.delete(alertId);
      await this.syncAlertsToServiceWorker();
      return true;
    }
    return false;
  }

  /**
   * Supprime une alerte par nom de domaine
   */
  async removeAlertByDomain(domain: string): Promise<boolean> {
    const result = await db.removeAlertsByDomain(domain);
    if (result.success && result.data && result.data > 0) {
      // Supprimer du cache local
      for (const [id, alert] of this.alerts.entries()) {
        if (alert.domain === domain) {
          this.alerts.delete(id);
        }
      }
      await this.syncAlertsToServiceWorker();
      return true;
    }
    return false;
  }

  /**
   * Récupère une alerte par nom de domaine
   */
  async getAlertByDomain(domain: string): Promise<AlertSettings | undefined> {
    // Vérifier d'abord le cache local
    for (const alert of this.alerts.values()) {
      if (alert.domain === domain) {
        return alert;
      }
    }
    
    // Si pas en cache, chercher en base
    const result = await db.getAlertByDomain(domain);
    if (result.success && result.data) {
      const alert = this.convertDbRecordToAlert(result.data);
      this.alerts.set(alert.id, alert);
      return alert;
    }
    
    return undefined;
  }

  /**
   * Récupère toutes les alertes
   */
  async getAllAlerts(): Promise<AlertSettings[]> {
    const result = await db.getAllAlerts();
    if (result.success) {
      // Mettre à jour le cache local
      this.alerts.clear();
      const alerts = result.data?.map(record => {
        const alert = this.convertDbRecordToAlert(record);
        this.alerts.set(alert.id, alert);
        return alert;
      }) || [];
      
      return alerts;
    }
    
    // Fallback sur le cache local en cas d'erreur
    return Array.from(this.alerts.values());
  }

  /**
   * Synchronise les alertes avec le Service Worker pour les notifications en arrière-plan
   */
  private async syncAlertsToServiceWorker(): Promise<void> {
    if (!this.worker) {
      return;
    }

    try {
      const alertsArray = Array.from(this.alerts.values());
      this.worker.postMessage({
        type: 'SYNC_ALERTS',
        alerts: alertsArray
      });
    } catch (error) {
      console.error('Erreur lors de la synchronisation avec le Service Worker:', error);
    }
  }

  /**
   * Demande une vérification manuelle des notifications au Service Worker
   */
  async triggerNotificationCheck(): Promise<void> {
    if (!this.worker) {
      console.warn('Service Worker non disponible pour la vérification des notifications');
      return;
    }

    try {
      this.worker.postMessage({
        type: 'CHECK_NOTIFICATIONS'
      });
    } catch (error) {
      console.error('Erreur lors du déclenchement de la vérification:', error);
    }
  }

  /**
   * Convertit un enregistrement de base en AlertSettings
   */
  private convertDbRecordToAlert(record: db.AlertRecord): AlertSettings {
    return {
      ...record,
      expirationDate: new Date(record.expirationDate),
      createdAt: new Date(record.createdAt),
      lastNotified: record.lastNotified ? new Date(record.lastNotified) : undefined
    };
  }

  /**
   * Charge les alertes depuis la base de données
   */
  private async loadAlertsFromDatabase(): Promise<void> {
    try {
      const result = await db.getAllAlerts();
      if (result.success && result.data) {
        this.alerts.clear();
        
        for (const alertRecord of result.data) {
          const alert = this.convertDbRecordToAlert(alertRecord);
          this.alerts.set(alert.id, alert);
        }
        
        // Synchroniser avec le Service Worker après le chargement
        await this.syncAlertsToServiceWorker();
      }
    } catch (error) {
      console.error('Erreur lors du chargement des alertes depuis la base:', error);
      
      // Fallback: essayer de migrer depuis localStorage
      await this.migrateLegacyAlerts();
    }
  }

  /**
   * Migration depuis localStorage (pour compatibilité)
   */
  private async migrateLegacyAlerts(): Promise<void> {
    try {
      const stored = localStorage.getItem('domain-alerts');
      if (stored) {
        const alertsArray = JSON.parse(stored);
        
        for (const alertData of alertsArray) {
          const alert: AlertSettings = {
            ...alertData,
            expirationDate: new Date(alertData.expirationDate),
            createdAt: new Date(alertData.createdAt),
            lastNotified: alertData.lastNotified ? new Date(alertData.lastNotified) : undefined
          };
          
          // Sauvegarder en base
          const alertRecord: db.AlertRecord = {
            ...alert,
            expirationDate: alert.expirationDate.toISOString(),
            createdAt: alert.createdAt.toISOString(),
            lastNotified: alert.lastNotified?.toISOString()
          };
          
          await db.saveAlert(alertRecord);
          this.alerts.set(alert.id, alert);
        }
        
        // Supprimer les données legacy
        localStorage.removeItem('domain-alerts');
        
        console.log('Migration des alertes depuis localStorage terminée');
        await this.syncAlertsToServiceWorker();
      }
    } catch (error) {
      console.error('Erreur lors de la migration des alertes:', error);
    }
  }
}

// Instance singleton
export const alertService = AlertService.getInstance();

// Fonctions utilitaires exportées
export const checkNotificationSupport = () => alertService.checkNotificationSupport();
export const requestNotificationPermission = () => alertService.requestNotificationPermission();
export const saveAlert = (settings: Omit<AlertSettings, 'id' | 'createdAt'>) => alertService.saveAlert(settings);
export const removeAlert = (alertId: string) => alertService.removeAlert(alertId);
export const removeAlertByDomain = (domain: string) => alertService.removeAlertByDomain(domain);
export const getAlertByDomain = (domain: string) => alertService.getAlertByDomain(domain);
export const getAllAlerts = () => alertService.getAllAlerts();
export const triggerNotificationCheck = () => alertService.triggerNotificationCheck();
