import { BUILD, NAMESPACE } from '@app-data';
import { consoleDevInfo, doc, H, promiseResolve } from '@platform';

import type * as d from '../declarations';

export const patchBrowser = (): Promise<d.CustomElementsDefineOptions> => {
  // NOTE!! This fn cannot use async/await!
  if (BUILD.isDev && !BUILD.isTesting) {
    consoleDevInfo('Running in development mode.');
  }

  if (BUILD.cloneNodeFix) {
    // opted-in to polyfill cloneNode() for slot polyfilled components
    patchCloneNodeFix((H as any).prototype);
  }

  if (BUILD.profile && !performance.mark) {
    // not all browsers support performance.mark/measure (Safari 10)
    // because the mark/measure APIs are designed to write entries to a buffer in the browser that does not exist,
    // simply stub the implementations out.
    // TODO(STENCIL-323): Remove this patch when support for older browsers is removed (breaking)
    // @ts-ignore
    performance.mark = performance.measure = () => {
      /*noop*/
    };
    performance.getEntriesByName = () => [];
  }

  // @ts-ignore
  const scriptElm = BUILD.scriptDataOpts
    ? Array.from(doc.querySelectorAll('script')).find(
        (s) =>
          new RegExp(`\/${NAMESPACE}(\\.esm)?\\.js($|\\?|#)`).test(s.src) ||
          s.getAttribute('data-stencil-namespace') === NAMESPACE
      )
    : null;
  const importMeta = import.meta.url;
  const opts = BUILD.scriptDataOpts ? ((scriptElm as any) || {})['data-opts'] || {} : {};

  if (importMeta !== '') {
    opts.resourcesUrl = new URL('.', importMeta).href;
  }

  return promiseResolve(opts);
};

const patchCloneNodeFix = (HTMLElementPrototype: any) => {
  const nativeCloneNodeFn = HTMLElementPrototype.cloneNode;

  HTMLElementPrototype.cloneNode = function (this: Node, deep: boolean) {
    if (this.nodeName === 'TEMPLATE') {
      return nativeCloneNodeFn.call(this, deep);
    }
    const clonedNode = nativeCloneNodeFn.call(this, false);
    const srcChildNodes = this.childNodes;
    if (deep) {
      for (let i = 0; i < srcChildNodes.length; i++) {
        // Node.ATTRIBUTE_NODE === 2, and checking because IE11
        if (srcChildNodes[i].nodeType !== 2) {
          clonedNode.appendChild(srcChildNodes[i].cloneNode(true));
        }
      }
    }
    return clonedNode;
  };
};
