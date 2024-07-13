// InputSource.d.ts

interface InputSource {
  changeInputSource(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: ChangeInputSourceOptions
  ): void;
  getExternalInputList(
    successCallback: (cbObject: ExternalInputList) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: GetExternalInputListOptions
  ): void;
  getInputSourceStatus(
    successCallback: (cbObject: InputSourceStatus) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  initialize(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: InitializeOptions
  ): void;
}

interface ChangeInputSourceOptions {
  src: string; // Format: "ext://[EXTERNAL_INPUT]:[PORT_NUM]", e.g., "ext://hdmi:1"
}

interface GetExternalInputListOptions {
  subscribe?: boolean; // true to subscribe, false to not subscribe (default)
}

interface ExternalInputList {
  inputSourceList: {
    inputPort: string; // e.g., "ext://hdmi:1", "ext://dp:1"
    signalDetection: boolean; // true if detected, false if not detected
    vendorID?: boolean; // HDMI-CEC only, SIMPLINK has to be enabled
    name?: boolean; // HDMI-CEC only, SIMPLINK has to be enabled
  }[];
  subscribed: boolean; // true if subscription is enabled, false if not
  count: number; // number of all digital input sources
  currentInputPort: string; // input source label currently selected
}

interface InputSourceStatus {
  inputSourceList: {
    inputPort: string; // e.g., "ext://hdmi:2", "ext://dp:1"
  }[];
  currentSignalState: 'good' | 'bad' | 'unknown'; // signal status of the current input source
  currentInputSource: string; // input source label of the current input source
}

interface InitializeOptions {
  divId: string; // ID of the div tag in which the video tag is to be created
  videoId: string; // ID of the video tag to be created
  callback: () => void; // event handler to handle the onloadedmetadata event
  src: string; // src attribute of the video tag, format: "ext://[EXTERNAL_INPUT]:[PORT_NUM]"
}

declare const InputSource: {
  new (): InputSource;
};
