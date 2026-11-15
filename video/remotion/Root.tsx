import { Composition } from "remotion";
import { Video } from "./Video";
import type { VideoProps } from "./types";

const defaults: VideoProps = {
  base: "http://127.0.0.1:1",
  fps: 30,
  durationInFrames: 300,
  lines: [],
  scenes: [],
  rec: { viewport: { width: 430, height: 932 }, scale: 2, frames: [], events: [] },
  preview: "",
  previewUrl: "",
  telegramText: "",
  parcelMessage: "",
  site: "",
  bot: "",
};

export function RemotionRoot() {
  return (
    <Composition
      id="ScamCheckDemo"
      component={Video}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={300}
      defaultProps={defaults}
      calculateMetadata={({ props }) => ({ durationInFrames: props.durationInFrames, fps: props.fps })}
    />
  );
}
