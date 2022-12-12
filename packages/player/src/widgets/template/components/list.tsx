import gsap from "gsap";
import {
  Component,
  createSignal,
  For,
  onCleanup,
  onMount,
  Setter,
} from "solid-js";
import { TemplateComponent, TemplateComponentType } from "./group";
import { Item, TemplateComponentTypeUnion } from "./item";
import { Model } from "../data/model";

export class ListComponent implements TemplateComponent {
  readonly type = TemplateComponentType.List;

  constructor(
    public name: string,
    public model: Model,
    public binding: string,
    public style: string,
    public component: TemplateComponentTypeUnion,
    public pageDuration: number
  ) {}
}

// TODO: Add support for displaying a progress indicator, something like horizontal bullets,
// one bullet per page, and the activa page should be shown in a different color: o o x o
export const List: Component<{
  name: string;
  value: any[];
  style: string;
  component: TemplateComponentTypeUnion;
  pageDuration: number;
  timeline: GSAPTimeline;
  mediasMap: { [index: string]: string };
}> = (props) => {
  const [pages, setPages] = createSignal<any[][]>([props.value]);
  const [pageStyle, setPageStyle] = createSignal("");

  let textRef: HTMLDivElement | undefined;
  let timeline: GSAPTimeline = gsap.timeline({ repeat: -1 });

  props.timeline.add(timeline);

  onCleanup(() => {
    props.timeline.remove(timeline);
    timeline.kill();
  });

  onMount(() => {
    if (!textRef) {
      return;
    }

    const pagesRect = textRef.getBoundingClientRect();
    if (pagesRect.width === 0 || pagesRect.height === 0) {
      return;
    }

    const itemsPerPage = Math.min(
      Math.max(calcNumItemsPerPage(textRef, props.value.length), 1),
      props.value.length
    );

    console.log({ itemsPerPage });

    if (itemsPerPage > 0) {
      const pages = [];
      for (let i = 0; i < props.value.length; i += itemsPerPage) {
        const page = props.value.slice(i, i + itemsPerPage);
        pages.push(page);
      }

      setPages(pages);
      setPageStyle(`position: absolute; width: ${pagesRect.width}px;`);
    }
  });

  // Use the offset to determine which page to show.
  return (
    <div data-component="list" data-name={props.name} style={props.style}>
      <div ref={textRef}>
        <For each={pages()}>
          {(page, i) => (
            <Page
              items={page}
              component={props.component}
              style={pageStyle()}
              timeline={timeline}
              offset={i() * props.pageDuration}
              duration={props.pageDuration}
              mediasMap={props.mediasMap}
              skipAnimation={pages().length == 1}
            />
          )}
        </For>
      </div>
    </div>
  );
};

const Page: Component<{
  items: any[];
  component: TemplateComponentTypeUnion;
  style: string;
  timeline: gsap.core.Timeline;
  offset: number;
  duration: number;
  mediasMap: { [index: string]: string };
  skipAnimation: boolean;
}> = (props) => {
  let pageRef: HTMLDivElement | undefined;

  onMount(() => {
    if (!pageRef) {
      return;
    }
    if (!props.skipAnimation) {
      props.timeline.from(
        pageRef.children,
        { opacity: 0, stagger: 0.1, duration: 1 },
        `>`
      );
      props.timeline.to(
        pageRef.children,
        { opacity: 0, stagger: 0.1, duration: 1 },
        `>+=${props.duration}`
      );
    }
  });

  return (
    <div ref={pageRef} style={props.style}>
      <For each={props.items}>
        {(item, i) => (
          <Item
            model={item}
            component={props.component}
            timeline={props.timeline}
            mediasMap={props.mediasMap}
          />
        )}
      </For>
    </div>
  );
};

function calcNumItemsPerPage(div: HTMLDivElement, numItems: number) {
  const listElement = div;

  const containerRect = div.parentElement!.getBoundingClientRect();
  if (containerRect.width === 0 || containerRect.height === 0) {
    return 0;
  }

  const maxHeight = Math.ceil(containerRect.height);

  const { height } = listElement.getBoundingClientRect();

  const itemHeight = height / numItems;

  return Math.floor(maxHeight / itemHeight);
}

// The code below should be more accurate but does not work for some issue with
// the rendering time.
const tolerance = 0.95;
const MAX_NUM_ITERATIONS = 10;

function maxNumItems(
  div: HTMLDivElement,
  items: any[],
  setItems: Setter<any[]>
) {
  if (div) {
    const listElement = div;

    setItems(items);

    const containerRect = div.parentElement!.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) {
      return;
    }

    let l = 1;
    let r = items.length;

    const maxHeight = Math.ceil(containerRect.height);
    const maxWidth = Math.ceil(containerRect.width);

    let count = 0;
    let lastWidth = 0,
      lastHeight = 0;
    let numItems;
    while (l < r && count < MAX_NUM_ITERATIONS) {
      count++;
      numItems = Math.ceil((l + r) / 2);

      setItems(items.slice(0, numItems));

      const { height, width } = listElement.getBoundingClientRect();

      if (
        (lastHeight == height && lastWidth == width) ||
        (height >= maxHeight * tolerance &&
          height <= maxHeight &&
          width >= maxWidth * tolerance &&
          width <= maxWidth)
      ) {
        break;
      }

      lastHeight = height;
      lastWidth = width;

      if (height <= maxHeight && width <= maxWidth) {
        // Make the text larger
        l = numItems;
      } else {
        // Make the text smaller
        r = numItems;
      }
    }
  }
}
