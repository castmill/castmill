
export interface DeviceEvent {
    id: string;
    timestamp: Date;
    msg: string;
    type_name: "online" | "offline" | "error" | "info" | "warning";
}
