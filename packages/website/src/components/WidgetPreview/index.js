import React, { useEffect, useRef, useState } from 'react';
import styles from './styles.module.css';
export default function WidgetPreview({ widget, data = {}, options = {}, height = '400px', showControls = false, bare = false, }) {
    const containerRef = useRef(null);
    const widgetInstanceRef = useRef(null);
    const playSubscriptionRef = useRef(null);
    const [error, setError] = useState(null);
    const [isPlaying, setIsPlaying] = useState(!showControls); // Auto-play when controls hidden
    const [TemplateWidget, setTemplateWidget] = useState(null);
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
        if (!containerRef.current || !TemplateWidget)
            return;
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
            }
            catch (e) {
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
                get: async (key) => ({ cachedUrl: key }),
                set: async (key, type, mime, opts) => ({
                    cachedUrl: key,
                }),
                remove: async (key) => { },
                clear: async () => { },
            };
            const resourceManager = new ResourceManager({
                storage: {
                    get: async (key) => null,
                    set: async (key, value) => { },
                    remove: async (key) => { },
                },
                target: 'web',
            });
            // Override cache and getMedia to return URLs directly (pass-through)
            resourceManager.cache = mockCache;
            resourceManager.getMedia = async (url) => url;
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
                                import('rxjs')
                                    .then((rxjs) => {
                                    // Check again after async import
                                    if (!widgetInstanceRef.current)
                                        return;
                                    // Create a simple timer observable
                                    const timer$ = new rxjs.Observable((subscriber) => {
                                        let frame = 0;
                                        const interval = setInterval(() => {
                                            subscriber.next(frame++);
                                        }, 16); // ~60fps
                                        return () => clearInterval(interval);
                                    });
                                    // Store the subscription so we can unsubscribe later
                                    playSubscriptionRef.current = widgetInstanceRef.current
                                        .play(timer$)
                                        .subscribe({
                                        error: (err) => {
                                            console.error('Widget play error:', err);
                                        },
                                    });
                                })
                                    .catch((err) => {
                                    console.error('Failed to load rxjs:', err);
                                });
                            }
                            setError(null);
                        },
                        error: (err) => {
                            console.error('Widget show error:', err);
                            setError(`Failed to show widget: ${err.message}`);
                        },
                    });
                }
            }
            catch (err) {
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
                }
                catch (e) {
                    console.warn('Unsubscribe error:', e);
                }
            }
            // Clean up widget
            if (widgetInstanceRef.current) {
                try {
                    widgetInstanceRef.current.unload();
                }
                catch (e) {
                    console.warn('Cleanup error:', e);
                }
            }
        };
    }, [widget, data, options, isPlaying, TemplateWidget]);
    const handlePlayPause = () => {
        if (!widgetInstanceRef.current)
            return;
        if (isPlaying) {
            // Stop playing by unsubscribing
            if (playSubscriptionRef.current) {
                playSubscriptionRef.current.unsubscribe();
                playSubscriptionRef.current = null;
            }
            widgetInstanceRef.current.stop();
            setIsPlaying(false);
        }
        else {
            // Restart playing
            import('rxjs')
                .then((rxjs) => {
                // Check if widget still exists after async import
                if (!widgetInstanceRef.current)
                    return;
                const timer$ = new rxjs.Observable((subscriber) => {
                    let frame = 0;
                    const interval = setInterval(() => {
                        subscriber.next(frame++);
                    }, 16);
                    return () => clearInterval(interval);
                });
                playSubscriptionRef.current = widgetInstanceRef.current
                    .play(timer$)
                    .subscribe({
                    error: (err) => {
                        console.error('Widget play error:', err);
                    },
                });
            })
                .catch((err) => {
                console.error('Failed to load rxjs:', err);
            });
            setIsPlaying(true);
        }
    };
    const handleRestart = () => {
        if (!widgetInstanceRef.current)
            return;
        widgetInstanceRef.current.seek(0).subscribe();
        if (!isPlaying) {
            handlePlayPause();
        }
    };
    return (<div className={bare ? styles.widgetPreviewBare : styles.widgetPreviewContainer}>
      {showControls && !error && TemplateWidget && (<div className={styles.controls}>
          <button type="button" onClick={handlePlayPause} className={styles.controlButton} aria-label={isPlaying ? 'Pause preview' : 'Play preview'}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {isPlaying ? (<path d="M7 5h3v14H7zM14 5h3v14h-3z"/>) : (<path d="M8 5v14l11-7z"/>)}
            </svg>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button type="button" onClick={handleRestart} className={styles.controlButton} aria-label="Restart preview" disabled={!isPlaying}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/>
            </svg>
            Restart
          </button>
        </div>)}

      {error ? (<div className={styles.error}>
          <strong>Error:</strong> {error}
        </div>) : !TemplateWidget ? (<div className={styles.widgetContainer} style={{ height }}>
          <div className={styles.loading}>Loading preview…</div>
        </div>) : (<div ref={containerRef} className={styles.widgetContainer} style={{ height }}/>)}
    </div>);
}
