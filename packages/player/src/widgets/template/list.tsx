import gsap from 'gsap'
import {
  Component,
  createSignal,
  For,
  JSX,
  onCleanup,
  onMount,
  Setter,
} from 'solid-js'
import { Item } from './item'
import { resolveOption, TemplateConfig } from './binding'
import {
  TemplateComponent,
  TemplateComponentType,
  TemplateComponentTypeUnion,
} from './template'
import { ResourceManager } from '@castmill/cache'
import { Timeline, TimelineItem } from './timeline'
import { ComponentAnimation } from './animation'
import { BaseComponentProps } from './interfaces/base-component-props'
import { PlayerGlobals } from '../../interfaces/player-globals.interface'

export interface ListComponentOptions {
  pageDuration: number
  pageSize: number
  items: any[]
}

export class ListComponent implements TemplateComponent {
  readonly type = TemplateComponentType.List

  constructor(
    public name: string,
    public config: TemplateConfig,
    public opts: ListComponentOptions,
    public style: JSX.CSSProperties,
    public component: TemplateComponentTypeUnion,
    public animations?: ComponentAnimation[],
    public filter?: Record<string, any>
  ) {}

  resolveDuration(medias: { [index: string]: string }): number {
    return (
      (this.opts.pageDuration * this.opts.items.length) / this.opts.pageSize
    )
  }

  static fromJSON(
    json: any,
    resourceManager: ResourceManager,
    globals: PlayerGlobals
  ): ListComponent {
    return new ListComponent(
      json.name,
      json.config,
      json.opts,
      json.style,
      TemplateComponent.fromJSON(json.component, resourceManager, globals),
      json.animations,
      json.filter
    )
  }

  static resolveOptions(
    opts: any,
    config: TemplateConfig,
    context: any,
    globals: PlayerGlobals
  ): ListComponentOptions {
    return {
      pageDuration: resolveOption(opts.pageDuration, config, context, globals),
      pageSize: resolveOption(opts.pageSize, config, context, globals),
      items: resolveOption(opts.items, config, context, globals),
    }
  }
}

interface ListProps extends BaseComponentProps {
  config: TemplateConfig
  opts: ListComponentOptions
  component: TemplateComponentTypeUnion
  resourceManager: ResourceManager
  globals: PlayerGlobals
}

// TODO: Add support for displaying a progress indicator, something like horizontal bullets,
// one bullet per page, and the activa page should be shown in a different color: o o x o
export const List: Component<ListProps> = (props) => {
  const [pages, setPages] = createSignal<any[][]>([props.opts.items])
  const [pageStyle, setPageStyle] = createSignal('')

  let textRef: HTMLDivElement | undefined
  let gsapTimeline: GSAPTimeline = gsap.timeline({ repeat: -1, paused: true })
  let timelineItem: TimelineItem

  let count = 0
  const onReadyAfter = () => {
    count++
    if (count == pages().length) {
      const timelineItem = {
        start: 0, // props.timeline.duration(),
        duration: gsapTimeline.duration(),
        repeat: !!gsapTimeline.repeat(),
        child: gsapTimeline,
      }
      props.timeline.add(timelineItem)

      props.onReady()
    }
  }

  onCleanup(() => {
    timelineItem && props.timeline.remove(timelineItem)
    gsapTimeline.kill()
  })

  onMount(() => {
    if (!textRef) {
      return
    }

    const pagesRect = textRef.getBoundingClientRect()
    if (pagesRect.width === 0 || pagesRect.height === 0) {
      return
    }

    const itemsPerPage = Math.min(
      Math.max(calcNumItemsPerPage(textRef, props.opts.items.length), 1),
      props.opts.items.length
    )

    if (itemsPerPage > 0) {
      const pages = []
      for (let i = 0; i < props.opts.items.length; i += itemsPerPage) {
        const page = props.opts.items.slice(i, i + itemsPerPage)
        pages.push(page)
      }

      setPages(pages)
      setPageStyle(`position: absolute; width: ${pagesRect.width}px;`)
    }
  })

  // Use the offset to determine which page to show.
  return (
    <div data-component="list" data-name={props.name} style={props.style}>
      <div ref={textRef}>
        <For each={pages()}>
          {(page, i) => (
            <Page
              config={props.config}
              items={page}
              component={props.component}
              style={pageStyle()}
              timeline={props.timeline}
              gsapTimeline={gsapTimeline}
              offset={i() * props.opts.pageDuration}
              duration={props.opts.pageDuration}
              skipAnimation={pages().length == 1}
              resourceManager={props.resourceManager}
              globals={props.globals}
              onReady={onReadyAfter}
            />
          )}
        </For>
      </div>
    </div>
  )
}

const Page: Component<{
  config: TemplateConfig
  items: any[]
  component: TemplateComponentTypeUnion
  style: string
  gsapTimeline: gsap.core.Timeline
  timeline: Timeline
  offset: number
  duration: number
  skipAnimation: boolean
  resourceManager: ResourceManager
  globals: PlayerGlobals
  onReady: () => void
}> = (props) => {
  let pageRef: HTMLDivElement | undefined

  let count = 0
  const onReadyAfter = () => {
    count++
    if (count == props.items.length) {
      props.onReady()
    }
  }

  onMount(() => {
    if (!pageRef) {
      return
    }
    if (!props.skipAnimation) {
      props.gsapTimeline.from(
        pageRef.children,
        { opacity: 0, stagger: 0.1, duration: 1 },
        `>`
      )
      props.gsapTimeline.to(
        pageRef.children,
        { opacity: 0, stagger: 0.1, duration: 1 },
        `>+=${props.duration}`
      )
    }
  })

  return (
    <div ref={pageRef} style={props.style}>
      <For each={props.items}>
        {(item, i) => (
          <Item
            config={props.config}
            context={item}
            component={props.component}
            timeline={props.timeline}
            resourceManager={props.resourceManager}
            onReady={onReadyAfter}
            globals={props.globals}
          />
        )}
      </For>
    </div>
  )
}

function calcNumItemsPerPage(div: HTMLDivElement, numItems: number) {
  const listElement = div

  const containerRect = div.parentElement!.getBoundingClientRect()
  if (containerRect.width === 0 || containerRect.height === 0) {
    return 0
  }

  const maxHeight = Math.ceil(containerRect.height)

  const { height } = listElement.getBoundingClientRect()

  const itemHeight = height / numItems

  return Math.floor(maxHeight / itemHeight)
}

// The code below should be more accurate but does not work for some issue with
// the rendering time.
const tolerance = 0.95
const MAX_NUM_ITERATIONS = 10

function maxNumItems(
  div: HTMLDivElement,
  items: any[],
  setItems: Setter<any[]>
) {
  if (div) {
    const listElement = div

    setItems(items)

    const containerRect = div.parentElement!.getBoundingClientRect()
    if (containerRect.width === 0 || containerRect.height === 0) {
      return
    }

    let l = 1
    let r = items.length

    const maxHeight = Math.ceil(containerRect.height)
    const maxWidth = Math.ceil(containerRect.width)

    let count = 0
    let lastWidth = 0,
      lastHeight = 0
    let numItems
    while (l < r && count < MAX_NUM_ITERATIONS) {
      count++
      numItems = Math.ceil((l + r) / 2)

      setItems(items.slice(0, numItems))

      const { height, width } = listElement.getBoundingClientRect()

      if (
        (lastHeight == height && lastWidth == width) ||
        (height >= maxHeight * tolerance &&
          height <= maxHeight &&
          width >= maxWidth * tolerance &&
          width <= maxWidth)
      ) {
        break
      }

      lastHeight = height
      lastWidth = width

      if (height <= maxHeight && width <= maxWidth) {
        // Make the text larger
        l = numItems
      } else {
        // Make the text smaller
        r = numItems
      }
    }
  }
}
