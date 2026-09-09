import React, { useCallback, useRef, useState } from "react";

import ConfirmModal from "@/ui/components/ConfirmModal";

interface ConfirmOptions {
  title: string;
  description?: string;
  icon?: string;
  iconColor?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

/**
 * Remplace Alert.alert par la ConfirmModal custom.
 * Usage : const confirm = useConfirm(); const ok = await confirm({title,...});
 */
export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { visible: boolean }) | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const [loading, setLoading] = useState(false);

  const close = useCallback((result: boolean) => {
    setState(null);
    setLoading(false);
    resolver.current?.(result);
    resolver.current = null;
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOptions): Promise<boolean> => {
      setLoading(false);
      setState({ ...opts, visible: true });
      return new Promise<boolean>((resolve) => {
        resolver.current = resolve;
      });
    },
    []
  );

  const element = (
    <ConfirmModal
      visible={!!state?.visible}
      title={state?.title ?? ""}
      description={state?.description}
      icon={state?.icon}
      iconColor={state?.iconColor}
      confirmLabel={state?.confirmLabel}
      cancelLabel={state?.cancelLabel}
      destructive={state?.destructive}
      loading={loading}
      onConfirm={() => close(true)}
      onClose={() => close(false)}
    />
  );

  return { confirm, ConfirmUI: element, setConfirmLoading: setLoading };
}

export default useConfirm;
