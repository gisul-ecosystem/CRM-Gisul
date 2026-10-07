import type { CSSProperties } from "react";

export function AuthShader() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 overflow-hidden"
			style={
				{
					"--auth-lav-200": "#e6e0fb",
					"--auth-lav-300": "#d3c9f8",
					"--auth-lav-400": "#bba6f7",
					"--auth-line": "rgba(130, 110, 200, 0.45)",
				} as CSSProperties
			}
		>
			<div className="absolute top-[-12vw] left-[-8vw] size-[min(45vw,560px)] rounded-full bg-[var(--auth-lav-200)] opacity-90 blur-[70px]" />
			<div className="absolute top-[5vw] right-[-10vw] h-[min(40vw,520px)] w-[min(28vw,360px)] rounded-full bg-[var(--auth-lav-200)] opacity-80 blur-[70px]" />
			<div className="absolute right-[-8vw] bottom-[-6vw] h-[min(35vw,460px)] w-[min(30vw,400px)] rounded-full bg-[var(--auth-lav-300)] opacity-70 blur-[70px]" />
			<div className="absolute bottom-[-8vw] left-[-8vw] size-[min(30vw,400px)] rounded-full bg-[var(--auth-lav-400)] opacity-75 blur-[70px]" />

			<svg
				className="absolute inset-0 size-full"
				viewBox="0 0 1536 1024"
				preserveAspectRatio="xMidYMid slice"
			>
				<defs>
					<linearGradient id="authCircleFill" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0" stopColor="#e9e4fb" stopOpacity=".9" />
						<stop offset="1" stopColor="#ffffff" stopOpacity="0" />
					</linearGradient>
					<linearGradient id="authSlabDark" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0" stopColor="#b79cf8" />
						<stop offset=".55" stopColor="#d9ccf9" />
						<stop offset="1" stopColor="#f4f0ff" stopOpacity=".4" />
					</linearGradient>
					<linearGradient id="authSlabLight" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0" stopColor="#e4defa" stopOpacity=".9" />
						<stop offset="1" stopColor="#ffffff" stopOpacity="0" />
					</linearGradient>
					<linearGradient id="authWaveFill" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stopColor="#e6e0fb" stopOpacity=".7" />
						<stop offset="1" stopColor="#ddd5fa" stopOpacity=".6" />
					</linearGradient>
				</defs>

				<path
					d="M0 0 H510 C470 150 330 270 150 295 C90 300 40 298 0 292 Z"
					fill="url(#authCircleFill)"
					stroke="var(--auth-line)"
					strokeWidth="1"
				/>
				<path
					d="M0 108 C90 190 180 222 255 218 C320 214 360 200 395 183 C330 250 230 285 140 283 C80 282 30 262 0 240 Z"
					fill="#ddd5fa"
					fillOpacity=".45"
				/>

				<path
					d="M0 545 L85 510 Q105 503 128 508 Q165 520 172 562 L255 985 L370 1024 L0 1024 Z"
					fill="url(#authSlabLight)"
				/>
				<path
					d="M170 590 L440 720 Q472 735 480 770 L515 920 L715 1024 L350 1024 Z"
					fill="url(#authSlabLight)"
					opacity=".7"
				/>
				<path
					d="M0 610 L275 742 Q310 760 318 795 L370 1024 L0 1024 Z"
					fill="url(#authSlabDark)"
				/>
				<path
					d="M0 760 L350 935 Q430 975 505 1024 L0 1024 Z"
					fill="#b9a8f8"
					fillOpacity=".45"
				/>
				<path
					d="M0 515 L40 530 M180 600 L440 722 M320 818 L715 1024"
					stroke="var(--auth-line)"
					strokeWidth="1"
					fill="none"
				/>

				<path
					d="M1345 0 C1420 55 1490 110 1495 260 C1498 400 1420 500 1300 590 L1270 690 C1260 800 1330 940 1400 1024 L1536 1024 L1536 420 C1520 500 1440 560 1360 600 C1250 670 1190 780 1210 880 C1220 950 1240 1000 1255 1024 L1536 1024 L1536 0 Z"
					fill="url(#authWaveFill)"
					opacity=".55"
				/>
				<path
					d="M1388 0 C1370 30 1370 60 1385 85 C1420 140 1500 200 1525 300 C1540 370 1520 430 1490 480 C1450 540 1380 570 1330 600 C1250 650 1195 760 1210 860 C1218 930 1240 990 1255 1024"
					fill="none"
					stroke="var(--auth-line)"
					strokeWidth="1"
				/>
				<path
					d="M1345 0 C1420 55 1490 110 1495 260 C1500 400 1440 500 1370 580 C1330 625 1285 660 1268 690"
					fill="none"
					stroke="var(--auth-line)"
					strokeWidth="1"
					opacity=".8"
				/>
			</svg>
		</div>
	);
}
