/**
 * Cloudflare Worker for Domain Check Push Notifications
 * 
 * Provides backend-as-a-service for PWA push notifications
 * Maintains privacy-first approach with minimal data collection
 * 
 * @version 1.0.0
 */

/// <reference types="@cloudflare/workers-types" />

// Worker environment bindings
interface Env {
  NOTIFICATIONS_KV: KVNamespace;
  VAPID_PRIVATE_KEY: string;
  VAPID_PUBLIC_KEY: string;
  CONTACT_EMAIL: string;
}

interface NotificationRecord {
  readonly domain: string;
  readonly alertDate: string;
  readonly expirationDate: string;
  readonly pushSubscription: {
    readonly endpoint: string;
    readonly keys: {
      readonly p256dh: string;
      readonly auth: string;
    };
  };
  readonly userAgent: string;
  readonly createdAt: string;
  readonly sent: boolean;
}

interface ScheduleRequest {
  readonly domain: string;
  readonly alertDate: string;
  readonly expirationDate: string;
  readonly pushSubscription: {
    readonly endpoint: string;
    readonly keys: {
      readonly p256dh: string;
      readonly auth: string;
    };
  };
  readonly userAgent: string;
}

interface CancelRequest {
  readonly domain: string;
}

export default {
  /**
   * Handle HTTP requests
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      switch (url.pathname) {
        case '/api/notifications/schedule':
          if (request.method === 'POST') {
            return await handleScheduleNotification(request, env, corsHeaders);
          }
          break;

        case '/api/notifications/cancel':
          if (request.method === 'POST') {
            return await handleCancelNotification(request, env, corsHeaders);
          }
          break;

        case '/api/notifications/vapid-key':
          if (request.method === 'GET') {
            return new Response(
              JSON.stringify({ publicKey: env.VAPID_PUBLIC_KEY }),
              { 
                headers: { 
                  'Content-Type': 'application/json',
                  ...corsHeaders 
                } 
              }
            );
          }
          break;

        case '/health':
          return new Response('OK', { headers: corsHeaders });

        default:
          return new Response('Not Found', { 
            status: 404, 
            headers: corsHeaders 
          });
      }

      return new Response('Method Not Allowed', { 
        status: 405, 
        headers: corsHeaders 
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Internal Server Error' 
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
  },

  /**
   * Handle scheduled events (cron jobs)
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Scheduled notification check triggered');
    ctx.waitUntil(checkAndSendNotifications(env));
  }
};

/**
 * Schedule a new notification
 */
async function handleScheduleNotification(
  request: Request, 
  env: Env, 
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const body: ScheduleRequest = await request.json();
    
    // Validate request
    if (!body.domain || !body.alertDate || !body.pushSubscription) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields' 
        }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    // Create notification record
    const record: NotificationRecord = {
      domain: body.domain,
      alertDate: body.alertDate,
      expirationDate: body.expirationDate,
      pushSubscription: body.pushSubscription,
      userAgent: body.userAgent,
      createdAt: new Date().toISOString(),
      sent: false
    };

    // Store in KV with domain as key
    const key = `notification:${body.domain}:${Date.now()}`;
    await env.NOTIFICATIONS_KV.put(key, JSON.stringify(record));

    console.log(`Notification scheduled for domain: ${body.domain}`);

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );

  } catch (error) {
    console.error('Schedule notification error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to schedule notification' 
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
}

/**
 * Cancel a scheduled notification
 */
async function handleCancelNotification(
  request: Request, 
  env: Env, 
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const body: CancelRequest = await request.json();
    
    if (!body.domain) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Domain is required' 
        }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    // Find and delete notifications for this domain
    const list = await env.NOTIFICATIONS_KV.list({ prefix: `notification:${body.domain}:` });
    
    for (const key of list.keys) {
      await env.NOTIFICATIONS_KV.delete(key.name);
    }

    console.log(`Notifications cancelled for domain: ${body.domain}`);

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );

  } catch (error) {
    console.error('Cancel notification error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to cancel notification' 
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
}

/**
 * Check for due notifications and send them
 */
async function checkAndSendNotifications(env: Env): Promise<void> {
  try {
    console.log('Checking for due notifications...');
    
    const now = new Date();
    const list = await env.NOTIFICATIONS_KV.list({ prefix: 'notification:' });
    
    let sent = 0;
    let errors = 0;

    for (const key of list.keys) {
      try {
        const recordData = await env.NOTIFICATIONS_KV.get(key.name);
        if (!recordData) continue;

        const record: NotificationRecord = JSON.parse(recordData);
        
        // Skip if already sent
        if (record.sent) continue;

        // Check if notification is due
        const alertDate = new Date(record.alertDate);
        if (now >= alertDate) {
          await sendPushNotification(record, env);
          
          // Mark as sent
          const updatedRecord = { ...record, sent: true };
          await env.NOTIFICATIONS_KV.put(key.name, JSON.stringify(updatedRecord));
          
          sent++;
          console.log(`Notification sent for domain: ${record.domain}`);
        }

      } catch (error) {
        errors++;
        console.error(`Error processing notification ${key.name}:`, error);
      }
    }

    console.log(`Notification check completed: ${sent} sent, ${errors} errors`);

  } catch (error) {
    console.error('Check notifications error:', error);
  }
}

/**
 * Send push notification using Web Push Protocol
 */
async function sendPushNotification(record: NotificationRecord, env: Env): Promise<void> {
  try {
    const expirationDate = new Date(record.expirationDate);
    const now = new Date();
    const daysUntilExpiration = Math.ceil(
      (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const payload = {
      title: '⚠️ Domain Expiration Alert',
      body: daysUntilExpiration === 1
        ? `Domain ${record.domain} expires tomorrow!`
        : daysUntilExpiration <= 0
        ? `Domain ${record.domain} has expired!`
        : `Domain ${record.domain} expires in ${daysUntilExpiration} days`,
      icon: '/icons/android-chrome-192x192.png',
      badge: '/icons/android-chrome-192x192.png',
      tag: `domain-alert-${record.domain}`,
      data: {
        domain: record.domain,
        expirationDate: record.expirationDate,
        daysUntilExpiration,
        timestamp: now.toISOString()
      }
    };

    // Generate VAPID headers
    const vapidHeaders = await generateVAPIDHeaders(
      record.pushSubscription.endpoint,
      env.VAPID_PRIVATE_KEY,
      env.VAPID_PUBLIC_KEY,
      env.CONTACT_EMAIL
    );

    // Send push notification
    const response = await fetch(record.pushSubscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'aes128gcm',
        ...vapidHeaders
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Push service responded with ${response.status}: ${response.statusText}`);
    }

  } catch (error) {
    console.error(`Failed to send push notification for ${record.domain}:`, error);
    throw error;
  }
}

/**
 * Generate VAPID headers for Web Push
 */
async function generateVAPIDHeaders(
  endpoint: string,
  privateKey: string,
  publicKey: string,
  email: string
): Promise<Record<string, string>> {
  // This is a simplified implementation
  // In production, you'd want to use a proper JWT library
  
  const urlBase = new URL(endpoint).origin;
  
  return {
    'Authorization': `vapid t=${privateKey}, k=${publicKey}`,
    'Crypto-Key': `p256ecdsa=${publicKey}`,
    'TTL': '86400' // 24 hours
  };
}