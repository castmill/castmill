import { JSX } from "solid-js/jsx-runtime";
import { ComponentAnimation } from "../animation";
import { Timeline } from "../timeline";

export interface BaseComponentProps {
  name?: string;
  cond?: Record<string, any>;
  $styles?: { cond: Record<string, any>; style: JSX.CSSProperties }[];
  animations?: ComponentAnimation[];

  style: JSX.CSSProperties;
  timeline: Timeline;
  onReady: () => void;
}
