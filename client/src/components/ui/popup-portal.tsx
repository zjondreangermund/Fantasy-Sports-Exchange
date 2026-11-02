import {FocusScope} from '@radix-ui/react-focus-scope';
import {DismissableLayer} from '@radix-ui/react-dismissable-layer';
import * as React from 'react';
import {createPortal} from 'react-dom';
import {POPUP_BASE_LAYER, registerPopup, unregisterPopup} from '../../lib/popup-stack';
export function usePopupLayer<T extends HTMLElement>(forwardedRef?: React.ForwardedRef<T>, minimum = POPUP_BASE_LAYER) {
  const current = React.useRef<T | null>(null);
  const [layer, setLayer] = React.useState(minimum);
  const ref = React.useCallback((node: T | null) => {
    if (current.current) unregisterPopup(current.current);
    current.current = node;
    if (node) {
      const next = registerPopup(node, minimum);
      node.style.zIndex = String(next + 1);
      setLayer(next);
    }
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef, minimum]);
  return {layer, ref};
}
/** For existing custom app overlays; shared Radix surfaces use the same stack. */
export function PopupPortal({children}: {children: React.ReactNode}) {
  const {layer, ref} = usePopupLayer<HTMLDivElement>();
  if (typeof document === 'undefined') return null;
  return createPortal(<FocusScope loop trapped asChild><DismissableLayer disableOutsidePointerEvents asChild><div ref={ref} tabIndex={-1} data-arena-popup style={{position:'fixed',inset:0,zIndex:layer+1,pointerEvents:'auto'}}>{children}</div></DismissableLayer></FocusScope>, document.body);
}
