import { ResourceManager } from "@castmill/cache";
import { Image, Layout, TemplateWidget, TextWidget, Video, Widget } from "..";
import { JsonLayout, JsonWidget } from "../interfaces";
import { TemplateComponentTypeUnion } from "./template/components/item";

export class WidgetFactory {
  static async fromJSON(
    json: JsonWidget,
    resourceManager: ResourceManager
  ): Promise<Widget | undefined> {
    // TODO: If it is an external widget we must load it dynamically, using a Proxy so that
    // the widget is isolated inside an iframe.
    // const widget = await Proxy.fromJSON(json);
    // const widget = await import(`./${json.uri}`);
    // const WidgetClass = await resourceManager.import("./image");
    // console.log(WidgetClass);

    switch (json.uri) {
      case "widget://image":
        return new Image(
          resourceManager,
          json.args as { src: string; size: "contain" | "cover" }
        );
      case "widget://video":
        return new Video(
          resourceManager,
          json.args as { src: string; volume: number }
        );
      case "widget://text":
        return new TextWidget(
          resourceManager,
          json.args as {
            text: string;
            css: Partial<CSSStyleDeclaration>;
            font?: { url: string; name: string };
            animation?: {
              from: gsap.TweenVars;
              perspective?: number;
              chars?: boolean;
            };
          }
        );
      /*
        case "widget://text-scroll":
        return new TextScroll(json.args as { text: Text[]; speed: number });
      */
      case "widget://layout":
        return Layout.fromLayoutJSON(json.args as JsonLayout, resourceManager);
      case "widget://template":
        return new TemplateWidget(
          resourceManager,
          json.args as {
            template: TemplateComponentTypeUnion;
            model: any;
            style: string;
            classes?: string;
          }
        );
    }
  }
}
