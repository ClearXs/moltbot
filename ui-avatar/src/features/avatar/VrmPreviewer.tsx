import { useCallback, useContext } from "react";
import { ViewerContext } from "./vrm/viewerContext";

export type VrmPreviewerProps = {
  vrm: string;
};

export default function VrmPreviewer({ vrm }: VrmPreviewerProps) {
  const { viewer } = useContext(ViewerContext);

  const canvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) {
        return;
      }
      viewer.setup(canvas);
      viewer.loadVrm(vrm);
      void viewer.setScene();
    },
    [viewer, vrm],
  );

  return <canvas ref={canvasRef} className="h-full w-full"></canvas>;
}
