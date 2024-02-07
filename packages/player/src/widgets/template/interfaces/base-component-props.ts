import { JSX } from 'solid-js/jsx-runtime'
import { ComponentAnimation } from '../animation'
import { Timeline } from '../timeline'

export interface BaseComponentProps {
  name?: string
  filter?: Record<string, any>
  $styles?: { filter: Record<string, any>; style: JSX.CSSProperties }[]
  animations?: ComponentAnimation[]

  style: JSX.CSSProperties
  timeline: Timeline
  onReady: () => void
}
