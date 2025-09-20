/**
 * Analytics service for tracking page views and events
 * Currently supports Cloudflare Web Analytics with SPA support
 */

interface AnalyticsPageView {
  path: string;
  title: string;
  timestamp?: number;
}

class AnalyticsService {
  private isDevelopment(): boolean {
    return typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('localhost')
    );
  }

  /**
   * Track a page view using the simplest and most reliable method
   */
  trackPageView(data: AnalyticsPageView): void {
    // Skip analytics in development mode to avoid CORS issues
    if (this.isDevelopment()) {
      console.log('📊 Analytics (dev):', `${data.path} - ${data.title}`);
      return;
    }

    try {
      // The most reliable method for Cloudflare Web Analytics:
      // Update the page URL and title, then manually trigger the beacon
      
      // Update document title
      if (document.title !== data.title) {
        document.title = data.title;
      }

      // Method 1: Use Cloudflare's official SPA method (if available)
      if (typeof window !== 'undefined' && (window as any).__cfBeacon) {
        const beacon = (window as any).__cfBeacon;
        
        // Try the official SPA tracking method
        if (beacon.spa && typeof beacon.spa === 'function') {
          beacon.spa(data.path);
          console.log('✅ CF Analytics: SPA tracking -', data.path);
          return;
        }

        // Try alternative method: queue-based tracking
        if (beacon.q && Array.isArray(beacon.q)) {
          beacon.q.push(['trackPageview', data.path]);
          console.log('✅ CF Analytics: Queued pageview -', data.path);
          return;
        }
      }

      // Method 2: Fallback - use History API + manual trigger
      this.triggerFallbackTracking(data);

    } catch (error) {
      console.error('❌ Analytics tracking failed:', error);
    }
  }

  /**
   * Fallback tracking method using History API
   */
  private triggerFallbackTracking(data: AnalyticsPageView): void {
    try {
      // Update the URL in the browser without navigation
      const currentUrl = new URL(window.location.href);
      const newUrl = new URL(data.path, window.location.origin);
      
      if (currentUrl.pathname !== newUrl.pathname) {
        // Use replaceState to update the URL for analytics
        window.history.replaceState(
          window.history.state,
          data.title,
          data.path
        );
      }

      // Trigger events that analytics tools commonly listen for
      const events = [
        new Event('routechange'),
        new Event('navigation'),
        new CustomEvent('spa-navigation', {
          detail: { path: data.path, title: data.title }
        })
      ];

      events.forEach(event => {
        window.dispatchEvent(event);
      });

      console.log('📍 CF Analytics: Fallback tracking -', data.path);
    } catch (error) {
      console.error('❌ Fallback tracking failed:', error);
    }
  }

  /**
   * Track custom events (for future use)
   */
  trackEvent(category: string, action: string, label?: string): void {
    if (this.isDevelopment()) {
      console.log('📊 Analytics (dev):', `Event: ${category}/${action}${label ? `/${label}` : ''}`);
      return;
    }

    try {
      if (typeof window !== 'undefined' && (window as any).__cfBeacon) {
        const beacon = (window as any).__cfBeacon;
        
        if (beacon.q && Array.isArray(beacon.q)) {
          beacon.q.push(['trackEvent', category, action, label]);
          console.log('✅ CF Analytics: Event tracked -', { category, action, label });
        }
      }
    } catch (error) {
      console.error('❌ Event tracking failed:', error);
    }
  }

  /**
   * Initialize analytics service
   */
  init(): void {
    if (this.isDevelopment()) {
      console.log('🔧 Analytics service: Development mode (tracking disabled)');
      return;
    }

    console.log('🚀 Analytics service: Production mode initialized');
    
    // Wait for Cloudflare script to load before attempting initial tracking
    if (typeof window !== 'undefined') {
      // Check if beacon is already loaded
      if ((window as any).__cfBeacon) {
        this.trackInitialPageView();
      } else {
        // Wait for the beacon to load
        let attempts = 0;
        const checkBeacon = () => {
          attempts++;
          if ((window as any).__cfBeacon || attempts > 20) {
            if ((window as any).__cfBeacon) {
              this.trackInitialPageView();
            } else {
              console.warn('⚠️ Cloudflare Analytics beacon not found after waiting');
            }
          } else {
            setTimeout(checkBeacon, 100);
          }
        };
        setTimeout(checkBeacon, 100);
      }
    }
  }

  private trackInitialPageView(): void {
    // Small delay to ensure everything is ready
    setTimeout(() => {
      this.trackPageView({
        path: window.location.pathname,
        title: document.title,
        timestamp: Date.now()
      });
    }, 500);
  }
}

// Export a singleton instance
export const analyticsService = new AnalyticsService();
export default analyticsService;
