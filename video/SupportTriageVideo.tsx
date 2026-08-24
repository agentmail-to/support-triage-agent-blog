import {
    AbsoluteFill,
    Easing,
    Img,
    interpolate,
    Series,
    spring,
    staticFile,
    useCurrentFrame,
    useVideoConfig,
} from "remotion"

type Point = {
    readonly x: number
    readonly y: number
}

type Focus = Point & {
    readonly width: number
    readonly height: number
}

type ScreenshotSceneProps = {
    readonly image: string
    readonly title: string
    readonly caption: string
    readonly cursorFrom: Point
    readonly cursorTo: Point
    readonly focus: Focus
}

function Cursor(props: {
    readonly x: number
    readonly y: number
    readonly click: number
}) {
    return (
        <div
            style={{
                position: "absolute",
                left: props.x,
                top: props.y,
                width: 70,
                height: 70,
                filter: "drop-shadow(0 4px 5px rgba(0,0,0,0.8))",
                transform: `scale(${1 - props.click * 0.14})`,
                transformOrigin: "8px 7px",
            }}
        >
            <svg viewBox="0 0 64 64" width="70" height="70" aria-hidden="true">
                <path
                    d="M7 4 50 35 29 38 18 58Z"
                    fill="#ffffff"
                    stroke="#050505"
                    strokeWidth="5"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    )
}

function ScreenshotScene(props: ScreenshotSceneProps) {
    const frame = useCurrentFrame()
    const { durationInFrames, fps } = useVideoConfig()
    const opacity = interpolate(
        frame,
        [0, 0.25 * fps, durationInFrames - 0.25 * fps, durationInFrames],
        [0, 1, 1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    )
    const cursorX = interpolate(
        frame,
        [0.35 * fps, 1.35 * fps],
        [props.cursorFrom.x, props.cursorTo.x],
        {
            easing: Easing.inOut(Easing.quad),
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
        },
    )
    const cursorY = interpolate(
        frame,
        [0.35 * fps, 1.35 * fps],
        [props.cursorFrom.y, props.cursorTo.y],
        {
            easing: Easing.inOut(Easing.quad),
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
        },
    )
    const click = spring({
        frame: frame - 1.4 * fps,
        fps,
        durationInFrames: 0.55 * fps,
        config: { damping: 16, stiffness: 220 },
    })
    const focusOpacity = spring({
        frame: frame - 1.25 * fps,
        fps,
        durationInFrames: 0.7 * fps,
        config: { damping: 200 },
    })
    const ringScale = interpolate(click, [0, 1], [0.35, 1.3])
    const ringOpacity = interpolate(click, [0, 0.45, 1], [0, 0.9, 0])

    return (
        <AbsoluteFill style={{ backgroundColor: "#050607", opacity }}>
            <Img
                src={staticFile(props.image)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div
                style={{
                    position: "absolute",
                    left: props.focus.x,
                    top: props.focus.y,
                    width: props.focus.width,
                    height: props.focus.height,
                    border: "4px solid #9ff5b3",
                    borderRadius: 14,
                    boxShadow:
                        "0 0 0 9999px rgba(0,0,0,0.22), 0 0 32px rgba(122,243,151,0.72)",
                    opacity: focusOpacity,
                }}
            />
            <div
                style={{
                    position: "absolute",
                    left: props.cursorTo.x - 36,
                    top: props.cursorTo.y - 36,
                    width: 84,
                    height: 84,
                    borderRadius: "50%",
                    border: "5px solid #9ff5b3",
                    opacity: ringOpacity,
                    transform: `scale(${ringScale})`,
                }}
            />
            <Cursor x={cursorX} y={cursorY} click={click} />
            <div
                style={{
                    position: "absolute",
                    left: 34,
                    bottom: 30,
                    maxWidth: 910,
                    padding: "18px 24px 20px",
                    border: "1px solid rgba(255,255,255,0.17)",
                    borderRadius: 16,
                    background: "rgba(4,5,6,0.9)",
                    boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
                    fontFamily:
                        "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                }}
            >
                <div style={{ color: "#ffffff", fontSize: 31, fontWeight: 720 }}>
                    {props.title}
                </div>
                <div style={{ color: "#b9c0c7", fontSize: 22, marginTop: 6 }}>
                    {props.caption}
                </div>
            </div>
        </AbsoluteFill>
    )
}

function TitleCard(props: { readonly outro?: boolean }) {
    const frame = useCurrentFrame()
    const { fps } = useVideoConfig()
    const reveal = spring({
        frame,
        fps,
        durationInFrames: 0.8 * fps,
        config: { damping: 200 },
    })
    const offset = interpolate(reveal, [0, 1], [22, 0])

    return (
        <AbsoluteFill
            style={{
                alignItems: "center",
                justifyContent: "center",
                background:
                    "radial-gradient(circle at 50% 35%, #19221c, #050606 62%)",
                color: "white",
                fontFamily:
                    "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                textAlign: "center",
            }}
        >
            <div style={{ opacity: reveal, transform: `translateY(${offset}px)` }}>
                <div
                    style={{
                        color: "#9ff5b3",
                        fontSize: 21,
                        fontWeight: 720,
                        letterSpacing: 3,
                        textTransform: "uppercase",
                    }}
                >
                    AgentMail support triage
                </div>
                <div style={{ fontSize: 62, fontWeight: 760, marginTop: 20 }}>
                    {props.outro
                        ? "The model never gets Send."
                        : "Sort the inbox. Keep Send human."}
                </div>
                <div style={{ color: "#aeb5bb", fontSize: 27, marginTop: 18 }}>
                    {props.outro
                        ? "Classifier chooses fields. Code chooses action. A teammate chooses Send."
                        : "Two emails. One safe draft. One human handoff."}
                </div>
            </div>
        </AbsoluteFill>
    )
}

export function SupportTriageVideo() {
    const { fps } = useVideoConfig()

    return (
        <Series>
            <Series.Sequence durationInFrames={2 * fps} premountFor={fps}>
                <TitleCard />
            </Series.Sequence>
            <Series.Sequence durationInFrames={5 * fps} premountFor={fps}>
                <ScreenshotScene
                    image="agentmail-routine-triage.png"
                    title="1. Routine question: draft ready"
                    caption="The app applies how-to, normal-priority, draft-ready, and processed labels."
                    cursorFrom={{ x: 660, y: 95 }}
                    cursorTo={{ x: 1360, y: 445 }}
                    focus={{ x: 1225, y: 398, width: 270, height: 96 }}
                />
            </Series.Sequence>
            <Series.Sequence durationInFrames={5 * fps} premountFor={fps}>
                <ScreenshotScene
                    image="agentmail-draft-composer.png"
                    title="2. AgentMail stores a reply draft"
                    caption="Approved copy stays in the same thread. The Send button still belongs to a teammate."
                    cursorFrom={{ x: 840, y: 120 }}
                    cursorTo={{ x: 1115, y: 751 }}
                    focus={{ x: 1054, y: 724, width: 142, height: 64 }}
                />
            </Series.Sequence>
            <Series.Sequence durationInFrames={5 * fps} premountFor={fps}>
                <ScreenshotScene
                    image="agentmail-billing-review.png"
                    title="3. Billing dispute: human review"
                    caption="High-priority billing mail gets a review label and no generated draft."
                    cursorFrom={{ x: 690, y: 92 }}
                    cursorTo={{ x: 1360, y: 475 }}
                    focus={{ x: 1225, y: 424, width: 270, height: 84 }}
                />
            </Series.Sequence>
            <Series.Sequence durationInFrames={5 * fps} premountFor={fps}>
                <ScreenshotScene
                    image="agentmail-webhook-attempts.png"
                    title="4. Both signed deliveries succeeded"
                    caption="This endpoint was created at 7:06 PM and received both fresh events at 7:17 PM."
                    cursorFrom={{ x: 860, y: 140 }}
                    cursorTo={{ x: 1080, y: 708 }}
                    focus={{ x: 272, y: 640, width: 1178, height: 158 }}
                />
            </Series.Sequence>
            <Series.Sequence durationInFrames={2 * fps} premountFor={fps}>
                <TitleCard outro />
            </Series.Sequence>
        </Series>
    )
}
