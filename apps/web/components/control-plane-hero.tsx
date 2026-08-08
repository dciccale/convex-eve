const surfaces = [
  { label: "WEB APP", x: 12, y: 92, icon: "web" },
  { label: "MOBILE", x: 12, y: 190, icon: "mobile" },
  {
    label: "BACKEND",
    x: 736,
    y: 92,
    icon: "backend",
  },
  {
    label: "JOBS + TRIGGERS",
    x: 736,
    y: 190,
    icon: "automation",
  },
] as const;

const agents = [
  { label: "ROOT AGENT", x: 460, y: 548, root: true },
  { label: "SUBAGENT", x: 300, y: 558, root: false },
  { label: "SUBAGENT", x: 620, y: 558, root: false },
] as const;

export function ControlPlaneHero() {
  return (
    <div
      className="control-plane control-plane--architecture"
      aria-hidden="true"
    >
      <div className="control-plane__halo" />
      <svg
        className="control-plane__svg"
        viewBox="0 25 920 595"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="archEdge" x1="280" y1="120" x2="650" y2="350">
            <stop stopColor="#a38cf4" stopOpacity=".22" />
            <stop offset=".52" stopColor="#eeeaff" stopOpacity=".68" />
            <stop offset="1" stopColor="#826bd4" stopOpacity=".3" />
          </linearGradient>
          <linearGradient id="archPlate" x1="315" y1="115" x2="604" y2="330">
            <stop stopColor="#1a1920" />
            <stop offset="1" stopColor="#09090d" />
          </linearGradient>
          <linearGradient id="evePlate" x1="335" y1="390" x2="585" y2="475">
            <stop stopColor="#21170c" />
            <stop offset=".55" stopColor="#121014" />
            <stop offset="1" stopColor="#0a090b" />
          </linearGradient>
          <radialGradient id="archGlow">
            <stop stopColor="#9b87f5" stopOpacity=".18" />
            <stop offset="1" stopColor="#9b87f5" stopOpacity="0" />
          </radialGradient>
          <filter
            id="archGoldGlow"
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id="archPurpleGlow"
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern
            id="archDotGrid"
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1" fill="#c4bdd7" opacity=".26" />
          </pattern>
          <marker
            id="purpleArrow"
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
          >
            <path d="M0 0 7 3.5 0 7Z" fill="#a38cf4" />
          </marker>
          <marker
            id="goldArrow"
            markerWidth="7"
            markerHeight="7"
            refX="1"
            refY="3.5"
            orient="auto"
          >
            <path d="M7 0 0 3.5 7 7Z" fill="#ffc963" />
          </marker>
        </defs>

        <text x="12" y="50" className="architecture__eyebrow">
          YOUR APPLICATION
        </text>
        <path d="M142 50H274" className="architecture__rule" />

        <g className="architecture__surfaces">
          {surfaces.map((surface, index) => (
            <g
              key={surface.label}
              className={`architecture__surface architecture__surface--${index}`}
            >
              <rect
                x={surface.x}
                y={surface.y}
                width="172"
                height="72"
                rx="12"
              />
              <rect
                x={surface.x + 14}
                y={surface.y + 16}
                width="40"
                height="40"
                rx="8"
                className="architecture__surface-icon-bg"
              />
              <SurfaceIcon
                kind={surface.icon}
                x={surface.x + 34}
                y={surface.y + 36}
              />
              <text
                x={surface.x + 66}
                y={surface.y + 41}
                className="architecture__surface-title"
              >
                {surface.label}
              </text>
            </g>
          ))}
          <path
            d="M184 128C240 128 250 147 309 164M184 226C238 226 256 211 309 195"
            className="architecture__surface-wire"
          />
          <path
            d="M736 128C680 128 670 147 611 164M736 226C682 226 664 211 611 195"
            className="architecture__surface-wire"
          />
          {[0, 1, 2, 3].map((index) => (
            <circle
              key={index}
              r="3.2"
              className={`architecture__surface-packet architecture__surface-packet--${index}`}
            >
              <animateMotion
                dur={`${2.6 + index * 0.25}s`}
                repeatCount="indefinite"
                path={
                  index === 0
                    ? "M184 128C240 128 250 147 309 164"
                    : index === 1
                      ? "M184 226C238 226 256 211 309 195"
                      : index === 2
                        ? "M736 128C680 128 670 147 611 164"
                        : "M736 226C682 226 664 211 611 195"
                }
              />
            </circle>
          ))}
          <circle r="2.6" className="architecture__state-packet">
            <animateMotion
              dur="3.1s"
              repeatCount="indefinite"
              path="M309 164C250 147 240 128 184 128"
            />
          </circle>
          <circle
            r="2.6"
            className="architecture__state-packet architecture__state-packet--1"
          >
            <animateMotion
              dur="3.4s"
              repeatCount="indefinite"
              path="M309 195C256 211 238 226 184 226"
            />
          </circle>
          <circle
            r="2.6"
            className="architecture__state-packet architecture__state-packet--2"
          >
            <animateMotion
              dur="3.2s"
              repeatCount="indefinite"
              path="M611 164C670 147 680 128 736 128"
            />
          </circle>
          <circle
            r="2.6"
            className="architecture__state-packet architecture__state-packet--3"
          >
            <animateMotion
              dur="3.5s"
              repeatCount="indefinite"
              path="M611 195C664 211 682 226 736 226"
            />
          </circle>
        </g>

        <g className="architecture__stack">
          <path
            d="m460 226 153 88-153 88-153-88Z"
            fill="#08080b"
            stroke="#45424f"
          />
          <path
            d="m460 182 153 88-153 88-153-88Z"
            fill="url(#archPlate)"
            stroke="#696374"
          />
          <path
            d="m460 138 153 88-153 88-153-88Z"
            fill="url(#archPlate)"
            stroke="url(#archEdge)"
            strokeWidth="1.6"
          />
          <path
            d="m460 138 153 88-153 88-153-88Z"
            fill="url(#archDotGrid)"
            opacity=".68"
          />
          <ellipse cx="460" cy="226" rx="124" ry="73" fill="url(#archGlow)" />

          <g className="architecture__layer-label architecture__layer-label--host">
            <text x="460" y="178">
              HOST FUNCTIONS
            </text>
            <text x="460" y="196" className="architecture__layer-detail">
              AUTH + PRODUCT POLICY
            </text>
          </g>
          <g className="architecture__layer-label architecture__layer-label--component">
            <path
              d="m460 207 22 13v25l-22 13-22-13v-25Z"
              fill="#111116"
              stroke="#8c7bdd"
            />
            <path
              d="m449 225 11 6 11-6m-22 8 11 6 11-6"
              stroke="#c6bcf2"
              strokeWidth="1.2"
            />
            <text x="460" y="279" className="architecture__component-title">
              CONVEX-EVE
            </text>
          </g>
          <g className="architecture__layer-label architecture__layer-label--state">
            <text x="460" y="326">
              THREADS · MESSAGES · STREAM CURSOR
            </text>
          </g>
        </g>

        <g className="architecture__bridge">
          <rect x="362" y="363" width="196" height="36" rx="18" />
          <circle cx="381" cy="381" r="4" />
          <text x="397" y="385">
            EVE SESSION API
          </text>
        </g>

        <g className="architecture__protocol-flow">
          <path
            d="M443 350v62"
            className="architecture__commands"
            markerEnd="url(#purpleArrow)"
          />
          <path
            d="M477 412v-62"
            className="architecture__events"
            markerEnd="url(#goldArrow)"
          />
          <text
            x="414"
            y="408"
            className="architecture__flow-label architecture__flow-label--commands"
          >
            COMMANDS
          </text>
          <text
            x="486"
            y="408"
            className="architecture__flow-label architecture__flow-label--events"
          >
            EVENTS
          </text>
        </g>

        <g className="architecture__eve">
          <path
            d="m460 406 131 52-131 52-131-52Z"
            fill="url(#evePlate)"
            stroke="#8c724b"
          />
          <path
            d="m460 419 98 39-98 39-98-39Z"
            stroke="#ffc963"
            strokeOpacity=".24"
            strokeDasharray="3 5"
          />
          <g filter="url(#archGoldGlow)">
            <path
              d="m460 430 24 14v28l-24 14-24-14v-28Z"
              fill="#21170b"
              stroke="#ffc963"
              strokeWidth="2"
            />
            <path
              d="m449 457 8 8 16-18"
              stroke="#ffd781"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          <text x="460" y="493" className="architecture__eve-title">
            EVE RUNTIME
          </text>
          <text x="460" y="508" className="architecture__eve-detail">
            AGENT EXECUTION
          </text>
        </g>

        <g className="architecture__agents">
          <path
            d="M460 510v14M435 524H325q-15 0-15 15v4M485 524h110q15 0 15 15v4"
            className="architecture__agent-wire"
          />
          {agents.map((agent, index) => (
            <g
              key={`${agent.label}-${agent.x}`}
              className={`architecture__agent architecture__agent--${index}`}
            >
              <circle cx={agent.x} cy={agent.y} r={agent.root ? 30 : 25} />
              <circle
                cx={agent.x}
                cy={agent.y}
                r={agent.root ? 20 : 16}
                className="architecture__agent-core"
              />
              <circle
                cx={agent.x}
                cy={agent.y}
                r="4"
                className="architecture__agent-dot"
                filter="url(#archPurpleGlow)"
              />
              <text x={agent.x} y={agent.y + (agent.root ? 48 : 42)}>
                {agent.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
      <div className="mobile-architecture">
        <div className="mobile-architecture__card mobile-architecture__card--app">
          <span className="mobile-architecture__kicker">YOUR APPLICATION</span>
          <strong>Web · Mobile · Backend · Jobs</strong>
        </div>
        <div className="mobile-architecture__exchange">
          <span>INTENT ↓</span>
          <span>↑ REALTIME STATE</span>
        </div>
        <div className="mobile-architecture__card mobile-architecture__card--convex">
          <span className="mobile-architecture__kicker">
            HOST AUTH + POLICY
          </span>
          <span className="mobile-architecture__mark">◆</span>
          <strong>CONVEX-EVE</strong>
          <small>Threads · Messages · Stream cursor</small>
        </div>
        <div className="mobile-architecture__bridge">
          <span className="mobile-architecture__signal" />
          EVE SESSION API
        </div>
        <div className="mobile-architecture__card mobile-architecture__card--eve">
          <span className="mobile-architecture__check">✓</span>
          <strong>EVE RUNTIME</strong>
          <small>Agent execution</small>
          <div className="mobile-architecture__agents">
            <span>SUBAGENT</span>
            <span>ROOT AGENT</span>
            <span>SUBAGENT</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SurfaceIcon({
  kind,
  x,
  y,
}: {
  kind: (typeof surfaces)[number]["icon"];
  x: number;
  y: number;
}) {
  if (kind === "web") {
    return (
      <>
        <rect x={x - 11} y={y - 8} width="22" height="16" rx="2" />
        <path
          d={`M${x - 11} ${y - 3}h22M${x - 5} ${y + 12}h10M${x} ${y + 8}v4`}
        />
      </>
    );
  }
  if (kind === "mobile") {
    return (
      <>
        <rect x={x - 7} y={y - 12} width="14" height="24" rx="3" />
        <circle cx={x} cy={y + 8} r="1" />
      </>
    );
  }
  if (kind === "backend") {
    return (
      <>
        <path d={`M${x - 13} ${y - 9}h8l4 5 4-5h8v18h-24Z`} />
        <path d={`M${x - 6} ${y + 3}h12`} />
      </>
    );
  }
  return (
    <>
      <circle cx={x} cy={y} r="4" />
      <circle cx={x - 11} cy={y + 8} r="3" />
      <circle cx={x + 11} cy={y + 8} r="3" />
      <path
        d={`M${x} ${y + 4}v4M${x - 8} ${y + 8}h16M${x - 11} ${y + 5}v-8M${x + 11} ${y + 5}v-8`}
      />
    </>
  );
}
