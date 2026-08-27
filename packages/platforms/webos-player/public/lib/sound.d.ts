// Sound.d.ts

interface Sound {
  getSoundMode(
    successCallback: (cbObject: SoundModeResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  getSoundOut(
    successCallback: (cbObject: SoundOutResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  getSoundStatus(
    successCallback: (cbObject: SoundStatusResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  setExternalSpeaker(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: ExternalSpeakerOptions
  ): void;
  setMuted(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: MutedOptions
  ): void;
  setSoundMode(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: SoundModeOptions
  ): void;
  setSoundOut(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: SoundOutOptions
  ): void;
  setVolumeLevel(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: VolumeLevelOptions
  ): void;
}

interface ErrorResponse {
  errorCode: number;
  errorText: string;
}

interface SoundModeResponse {
  mode: string;
  balance?: number;
}

interface SoundOutResponse {
  speakerType: string;
}

interface SoundStatusResponse {
  level: number;
  muted: boolean;
  externalSpeaker: boolean;
}

interface ExternalSpeakerOptions {
  externalSpeaker: boolean;
}

interface MutedOptions {
  muted: boolean;
}

interface SoundModeOptions {
  mode: string;
  balance?: number;
}

interface SoundOutOptions {
  speakerType: string;
}

interface VolumeLevelOptions {
  level: number;
  volOsdEnabled?: boolean;
}

declare const Sound: {
  new (): Sound;
  SoundMode: {
    Standard: 'standard';
    Cinema: 'movie';
    ClearVoice: 'news';
    Sports: 'sports';
    Music: 'music';
    Game: 'game';
  };
  SpeakerType: {
    SignageSpeaker: 'tv_speaker';
    LGSoundSync: 'bt_soundbar';
  };
};
