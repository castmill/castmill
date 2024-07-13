// Video.d.ts

interface Video {
  getVideoStatus(
    successCallback: (cbObject: VideoStatusResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  setVideoSize(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: VideoSizeOptions
  ): void;
}

interface VideoStatusResponse {
  source: VideoSource;
}

interface VideoSource {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ErrorResponse {
  errorCode: number;
  errorText: string;
}

interface VideoSizeOptions {
  source: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

declare const Video: {
  new (): Video;
};
