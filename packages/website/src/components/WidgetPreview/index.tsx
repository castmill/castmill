import React, { useEffect, useRef, useState } from 'react';
import styles from './styles.module.css';

// Use any for now to avoid TypeScript issues during development
interface JsonWidget {
  name: string;
  description?: string;
  template: any;
  options_schema?: any;
  data_schema?: any;
}

interface WidgetPreviewProps {
  widget: JsonWidget;
  data?: Record<string, any>;
  options?: Record<string, any>;
  height?: string;
  showControls?: boolean;
}

export default function WidgetPreview({
  widget,
  data = {},
  options = {},
  height = '400px',
  showControls = false,
}: WidgetPreviewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetInstanceRef = useRef<any>(null);
  const playSubscriptionRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(!showControls); // Auto-play when controls hidden
  const [TemplateWidget, setTemplateWidget] = useState<any>(null);

  // Load TemplateWidget dynamically (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@castmill/player')
        .then((module) => {
          setTemplateWidget(() => module.TemplateWidget);
        })
        .catch((err) => {
          console.error('Failed to load player:', err);
          setError('Failed to load widget player');
        });
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !TemplateWidget) return;

    // Clear any existing widget
    if (widgetInstanceRef.current) {
      try {
        // Unsubscribe from play observable first
        if (playSubscriptionRef.current) {
          playSubscriptionRef.current.unsubscribe();
          playSubscriptionRef.current = null;
        }
        // Unload the widget
        widgetInstanceRef.current.unload();
      } catch (e) {
        console.warn('Error cleaning up previous widget:', e);
      }
      widgetInstanceRef.current = null;
    }

    // Clear container
    containerRef.current.innerHTML = '';

    // Dynamically import ResourceManager
    import('@castmill/cache')
      .then((cacheModule) => {
        const ResourceManager = cacheModule.ResourceManager;
        
        // Create a simple pass-through resource manager for preview
        // Mock the cache to return URLs as-is
        const mockCache = {
          get: async (key: string) => ({ cachedUrl: key }),
          set: async (key: string, type: any, mime: any, opts: any) => ({ cachedUrl: key }),
          remove: async (key: string) => {},
          clear: async () => {},
        };
        
        const resourceManager = new ResourceManager({
          storage: {
            get: async (key: string) => null,
            set: async (key: string, value: any) => {},
            remove: async (key: string) => {},
          },
          target: 'web',
        });
        
        // Override cache and getMedia to return URLs directly (pass-through)
        (resourceManager as any).cache = mockCache;
        resourceManager.getMedia = async (url: string) => url;

        try {
          // Create widget instance with proper structure
          const templateWidget = new TemplateWidget(resourceManager, {
            widget: widget,
            config: {
              options,
              data,
            },
            globals: {
              // Minimal globals for preview
              screenWidth: containerRef.current?.clientWidth || 1920,
              screenHeight: containerRef.current?.clientHeight || 1080,
              target: 'web',
            },
          });

          widgetInstanceRef.current = templateWidget;

          // Show the widget using the Observable API
          if (containerRef.current) {
            const container = containerRef.current;
            templateWidget.show(container, 0).subscribe({
              next: () => {
                // Check if widget still exists and should play
                if (isPlaying && widgetInstanceRef.current) {
                  // Import Observable from rxjs
                  import('rxjs').then((rxjs) => {
                    // Check again after async import
                    if (!widgetInstanceRef.current) return;
                    
                    // Create a simple timer observable
                    const timer$ = new rxjs.Observable<number>((subscriber) => {
                      let frame = 0;
                      const interval = setInterval(() => {
                        subscriber.next(frame++);
                      }, 16); // ~60fps

                      return () => clearInterval(interval);
                    });

                    // Store the subscription so we can unsubscribe later
                    playSubscriptionRef.current = widgetInstanceRef.current.play(timer$).subscribe({
                      error: (err: Error) => {
                        console.error('Widget play error:', err);
                      },
                    });
                  }).catch((err) => {
                    console.error('Failed to load rxjs:', err);
                  });
                }
                setError(null);
              },
              error: (err: Error) => {
                console.error('Widget show error:', err);
                setError(`Failed to show widget: ${err.message}`);
              },
            });
          }
        } catch (err) {
          console.error('Widget creation error:', err);
          setError(`Failed to create widget: ${err instanceof Error ? err.message : String(err)}`);
        }
      })
      .catch((err) => {
        console.error('Failed to load cache module:', err);
        setError('Failed to load required modules');
      });

    // Cleanup on unmount
    return () => {
      // Unsubscribe from play observable
      if (playSubscriptionRef.current) {
        try {
          playSubscriptionRef.current.unsubscribe();
        } catch (e) {
          console.warn('Unsubscribe error:', e);
        }
      }
      
      // Clean up widget
      if (widgetInstanceRef.current) {
        try {
          widgetInstanceRef.current.unload();
        } catch (e) {
          console.warn('Cleanup error:', e);
        }
      }
    };
  }, [widget, data, options, isPlaying, TemplateWidget]);

  const handlePlayPause = () => {
    if (!widgetInstanceRef.current) return;

    if (isPlaying) {
      // Stop playing by unsubscribing
      if (playSubscriptionRef.current) {
        playSubscriptionRef.current.unsubscribe();
        playSubscriptionRef.current = null;
      }
      widgetInstanceRef.current.stop();
      setIsPlaying(false);
    } else {
      // Restart playing
      import('rxjs').then((rxjs) => {
        // Check if widget still exists after async import
        if (!widgetInstanceRef.current) return;
        
        const timer$ = new rxjs.Observable<number>((subscriber) => {
          let frame = 0;
          const interval = setInterval(() => {
            subscriber.next(frame++);
          }, 16);
          return () => clearInterval(interval);
        });

        playSubscriptionRef.current = widgetInstanceRef.current.play(timer$).subscribe({
          error: (err: Error) => {
            console.error('Widget play error:', err);
          },
        });
      }).catch((err) => {
        console.error('Failed to load rxjs:', err);
      });
      setIsPlaying(true);
    }
  };

  const handleRestart = () => {
    if (!widgetInstanceRef.current) return;

    widgetInstanceRef.current.seek(0).subscribe();
    
    if (!isPlaying) {
      handlePlayPause();
    }
  };

  return (
    <div className={styles.widgetPreviewContainer}>
      {showControls && !error && TemplateWidget && (
        <div className={styles.controls}>
          <button
            onClick={handlePlayPause}
            className={styles.controlButton}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶️'}
          </button>
          <button 
            onClick={handleRestart} 
            className={styles.controlButton} 
            title="Restart"
            disabled={!isPlaying}
            style={{ opacity: isPlaying ? 1 : 0.5, cursor: isPlaying ? 'pointer' : 'not-allowed' }}
          >
            ↻
          </button>
        </div>
      )}

      {error ? (
        <div className={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      ) : !TemplateWidget ? (
        <div className={styles.widgetContainer} style={{ height }}>
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading widget player...</div>
        </div>
      ) : (
        <div ref={containerRef} className={styles.widgetContainer} style={{ height }} />
      )}
    </div>
  );
}
