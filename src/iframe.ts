/**
 *  Helper functions to work with iframes.
 *
 */

import { Widget } from "./widgets";

// We may want to use "srcdoc" instead because that would allow us to "cache" the source of the iframe and
// make it faster.
  
// http://www.aaronpeters.nl/blog/iframe-loading-techniques-performance?%3E
export function createIframe(
  parent: HTMLElement,
  src?: string
): Promise<HTMLIFrameElement> {
  var iframe = document.createElement("iframe");
  iframe.style.display = "block";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.overflow = "hidden";
  iframe.frameBorder = "0";
  iframe.scrolling = "0";
  iframe.marginWidth = "0";
  iframe.marginHeight = "0";

  iframe.src = src || "about:blank";
  //iframe.src = "about:blank";
  parent.appendChild(iframe);

  if (!garbageBin) {
    garbageBin = document.createElement("div");
    //Make sure it is not displayed
    garbageBin.style.display = "none";
    document.body.appendChild(garbageBin);
  }

  /*
    var iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
    return new Promise(function(resolve, reject){
      $.get(src).then((html)=>{
        iframeDocument.open();
        iframeDocument.write(html);
        iframeDocument.close();
        iframe.addEventListener("load", (event) => resolve(iframe));
        iframe.addEventListener("error", (event) => reject("Error loading iframe..."));
      }, reject);
    });
    */

  return new Promise<HTMLIFrameElement>((resolve, reject) => {
    iframe.addEventListener("load", event => resolve(iframe));
    iframe.addEventListener("error", event =>
      reject("Error loading iframe...")
    );
  });
}

export function purgeIframe(iframe: HTMLIFrameElement) {
  if (iframe.parentElement) {
    iframe.parentElement.removeChild(iframe);
  }
  iframe.src = "about:blank";

  // Trying to put null on a nulled contentWindow raises an exception!
  /*
    if (iframe.contentWindow) {
      iframe.contentWindow = null;
    }
    */

  // Complete discard the iframe
  garbageBin.appendChild(iframe);
  garbageBin.innerHTML = "";
}

export function getIframeWidget(iframe: HTMLIFrameElement, content?: string) {
  if(content && iframe.contentWindow){
    const contentWindow: any = iframe.contentWindow;
    // Think if we could use Function("") instead of eval.
    contentWindow.eval(content);
  }
  
  if(iframe.contentWindow){
    const window: any = iframe.contentWindow;
    return window.widget;
  }
}

/*
  The garbageBin is a aditional measure to avoid memory leaks by
  overdimensioning clean up of the iframes.
*/
var garbageBin: HTMLDivElement;
