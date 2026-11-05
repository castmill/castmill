type NativePortraitMode = 'off' | '90' | '180' | '270';

declare class Custom {
  Configuration: {
    getNativePortraitMode?: (
      success: (result: { nativePortrait: unknown }) => void,
      failure: (error: unknown) => void
    ) => void;
    setNativePortraitMode?: (
      success: () => void,
      failure: (error: unknown) => void,
      options: { nativePortrait: NativePortraitMode }
    ) => void;
  };
  Signage?: {
    getwebOSVersion?: (
      success: (result: { webOSVersion?: unknown }) => void,
      failure: (error: unknown) => void
    ) => void;
  };
}
