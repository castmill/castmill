/**
 * Media item interface for UI components
 * This is a minimal interface for UI display purposes.
 * The player package has its own complete JsonMedia interface.
 */
export interface MediaItem {
  id: number;
  mimetype?: string;
  name: string;
  files?: {
    [context: string]: {
      url: string;
      [key: string]: any;
    };
  };
  [key: string]: any;
}
