import { Composition } from "remotion"
import { SupportTriageVideo } from "./SupportTriageVideo"

export function RemotionRoot() {
    return (
        <Composition
            id="SupportTriageGuided"
            component={SupportTriageVideo}
            durationInFrames={24 * 30}
            fps={30}
            width={1512}
            height={806}
        />
    )
}
