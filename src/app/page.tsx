import Link from 'next/link';
import {auth} from '@/auth';
import {HeroJoinCodeForm, LiveScreensPreviewGrid} from '@/components/LandingInteractive';

export default async function HomePage() {
    const session = await auth();
    const dashboardHref =
        session?.user?.role === 'admin'
            ? '/admin'
            : session?.user?.role === 'student'
              ? '/kelas'
              : '/masuk';
    const dashboardLabel =
        session?.user?.role === 'admin'
            ? 'Dashboard Admin'
            : session?.user?.role === 'student'
              ? 'Ruang Kelasku'
              : 'Masuk';

    return (
        <div>
            {/* ═══════ NAV ═══════ */}
            <nav className="pk-nav">
                <div className="pk-wrap pk-nav-row">
                    <div className="pk-nav-links">
                        <a href="#fitur">Fitur</a>
                        <a href="#cara">Cara Belajar</a>
                    </div>
                    <Link href="/" className="pk-nav-logo">
                        Petualang<span>Kode</span>
                    </Link>
                    <div className="pk-nav-right">
                        <Link href={dashboardHref} className="pk-nav-btn">
                            {dashboardLabel}
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ═══════ HERO ═══════ */}
            <section className="pk-hero">
                <div className="pk-hero-circle pk-hc1" />
                <div className="pk-hero-circle pk-hc2" />
                <div className="pk-hero-circle pk-hc3" />

                <div className="pk-wrap pk-hero-inner">
                    <div>
                        <p className="pk-hero-trail">
                            Petualang Kode <span>›</span> Belajar Sambil Bermain
                        </p>
                        <h1 className="pk-hero-h1">
                            Setiap anak punya cerita.
                            <br />
                            Mereka juga bisa
                            <br />
                            <em>menulis kodenya.</em>
                        </h1>
                        <p className="pk-hero-body">
                            Petualang Kode belajar coding langsung bersama guru — mulai dari cerita
                            bergerak, menyusun blok, hingga mencapai garis akhir bersama.
                        </p>
                        <div className="pk-hero-cta">
                            <Link href={dashboardHref} className="pk-btn-masuk">
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                                    <path
                                        d="M9 2a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm0 9c3.86 0 7 1.79 7 4v.5a.5.5 0 0 1-.5.5h-13A.5.5 0 0 1 2 15V15c0-2.21 3.14-4 7-4z"
                                        fill="currentColor"
                                    />
                                </svg>
                                {dashboardLabel} →
                            </Link>
                            <HeroJoinCodeForm />
                        </div>
                    </div>

                    {/* RIGHT — Kelinci Penjelajah SVG */}
                    <div className="pk-hero-right">
                        <div className="pk-sparkle" style={{top: 40, left: 30}}>
                            ✦
                        </div>
                        <div className="pk-sparkle" style={{top: 80, right: 40, fontSize: 14}}>
                            ✧
                        </div>
                        <div className="pk-sparkle" style={{bottom: 100, left: 50, fontSize: 12}}>
                            ✦
                        </div>
                        <div className="pk-annot" style={{top: 28, right: 30}}>
                            Ayo coba! ↗
                        </div>
                        <div
                            className="pk-annot"
                            style={{bottom: 72, right: 20, color: 'rgba(255,255,255,.85)'}}
                        >
                            Sampai tujuan! ↙
                        </div>

                        <div className="pk-mascot-wrap">
                            <svg
                                width="340"
                                height="400"
                                viewBox="0 0 340 400"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                role="img"
                                aria-label="Maskot Kelinci Penjelajah Petualang Kode"
                            >
                                <defs>
                                    <radialGradient id="wristGlow" cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stopColor="#6EF7FF" stopOpacity="0.75" />
                                        <stop offset="60%" stopColor="#04A5AD" stopOpacity="0.25" />
                                        <stop offset="100%" stopColor="#04A5AD" stopOpacity="0" />
                                    </radialGradient>
                                    <linearGradient id="vestGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#FFB938" />
                                        <stop offset="100%" stopColor="#E58B12" />
                                    </linearGradient>
                                    <linearGradient id="hatGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#283C78" />
                                        <stop offset="100%" stopColor="#172349" />
                                    </linearGradient>
                                </defs>
                                <ellipse cx="172" cy="376" rx="88" ry="12" fill="#025f65" opacity="0.32" />
                                <path
                                    d="M108 308 C88 304 82 288 94 278 C98 272 108 274 114 282 Z"
                                    fill="#F6D59C"
                                />
                                <path
                                    d="M106 305 C92 302 88 292 96 284 C102 280 110 284 112 292 Z"
                                    fill="#FFF2D6"
                                />
                                <g>
                                    <path
                                        d="M132 108 C110 74 92 42 98 24 C104 10 124 14 140 42 C152 62 158 88 156 108 Z"
                                        fill="#F6D59C"
                                    />
                                    <path
                                        d="M98 24 C104 10 122 14 134 34 C122 40 108 42 98 44 C95 36 96 28 98 24 Z"
                                        fill="#1E2D5A"
                                    />
                                    <path
                                        d="M132 100 C118 76 108 54 112 44 C118 42 128 52 138 70 C144 82 146 94 144 102 Z"
                                        fill="#F2B488"
                                    />
                                </g>
                                <g>
                                    <path
                                        d="M192 98 C196 68 210 48 228 52 C248 56 264 78 266 96 C268 106 258 112 248 106 C238 100 226 84 214 84 C208 84 204 92 204 102 Z"
                                        fill="#F6D59C"
                                    />
                                    <path
                                        d="M214 84 C222 76 232 76 240 84"
                                        stroke="#DDA864"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        fill="none"
                                    />
                                    <path
                                        d="M244 74 C256 80 265 90 266 96 C268 106 258 112 248 106 C242 102 238 94 236 86 C239 81 242 77 244 74 Z"
                                        fill="#1E2D5A"
                                    />
                                </g>
                                <path
                                    d="M116 278 C108 308 114 336 124 352 L148 352 C152 340 158 334 172 334 C186 334 192 340 196 352 L222 352 C230 334 234 304 224 278 Z"
                                    fill="#F6D59C"
                                />
                                <path
                                    d="M150 334 C162 328 182 328 194 334"
                                    stroke="#E5B97A"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    fill="none"
                                />
                                <g>
                                    <ellipse cx="122" cy="358" rx="28" ry="12" fill="#F6D59C" />
                                    <path
                                        d="M94 358 C94 349 106 346 116 348 C116 355 114 363 112 369 C100 368 94 364 94 358 Z"
                                        fill="#1E2D5A"
                                    />
                                    <line
                                        x1="102"
                                        y1="354"
                                        x2="104"
                                        y2="365"
                                        stroke="#F6D59C"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                    <line
                                        x1="110"
                                        y1="353"
                                        x2="111"
                                        y2="366"
                                        stroke="#F6D59C"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                </g>
                                <g>
                                    <ellipse cx="222" cy="358" rx="28" ry="12" fill="#F6D59C" />
                                    <path
                                        d="M250 358 C250 349 238 346 228 348 C228 355 230 363 232 369 C244 368 250 364 250 358 Z"
                                        fill="#1E2D5A"
                                    />
                                    <line
                                        x1="242"
                                        y1="354"
                                        x2="240"
                                        y2="365"
                                        stroke="#F6D59C"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                    <line
                                        x1="234"
                                        y1="353"
                                        x2="233"
                                        y2="366"
                                        stroke="#F6D59C"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                </g>
                                <ellipse cx="172" cy="264" rx="52" ry="56" fill="#F6D59C" />
                                <ellipse cx="172" cy="270" rx="34" ry="44" fill="#FFF2D6" />
                                <g>
                                    <path
                                        d="M214 230 C232 240 242 258 238 274 C234 284 220 286 212 276 C206 266 206 250 206 238 Z"
                                        fill="#F6D59C"
                                    />
                                    <circle cx="225" cy="276" r="14" fill="#1E2D5A" />
                                    <ellipse cx="224" cy="279" rx="5" ry="4" fill="#F2B488" />
                                    <circle cx="218" cy="271" r="2.2" fill="#F2B488" />
                                    <circle cx="225" cy="269" r="2.2" fill="#F2B488" />
                                    <circle cx="231" cy="272" r="2.2" fill="#F2B488" />
                                </g>
                                <g>
                                    <path
                                        d="M126 218 C118 234 116 270 120 294 C132 298 148 298 154 294 C156 268 154 236 146 218 Z"
                                        fill="url(#vestGrad)"
                                        stroke="#C9770C"
                                        strokeWidth="2"
                                    />
                                    <path
                                        d="M218 218 C226 234 228 270 224 294 C212 298 196 298 190 294 C188 268 190 236 198 218 Z"
                                        fill="url(#vestGrad)"
                                        stroke="#C9770C"
                                        strokeWidth="2"
                                    />
                                    <rect
                                        x="131"
                                        y="236"
                                        width="18"
                                        height="20"
                                        rx="3"
                                        fill="#E58B12"
                                        stroke="#B86B08"
                                        strokeWidth="1.5"
                                    />
                                    <rect
                                        x="131"
                                        y="236"
                                        width="18"
                                        height="6"
                                        rx="2"
                                        fill="#F5A623"
                                        stroke="#B86B08"
                                        strokeWidth="1.5"
                                    />
                                    <rect x="138" y="234" width="4" height="10" rx="1.5" fill="#1E2D5A" />
                                    <rect
                                        x="128"
                                        y="266"
                                        width="22"
                                        height="18"
                                        rx="4"
                                        fill="#E58B12"
                                        stroke="#B86B08"
                                        strokeWidth="1.5"
                                    />
                                    <path
                                        d="M128 269 Q139 276 150 269"
                                        stroke="#B86B08"
                                        strokeWidth="1.5"
                                        fill="none"
                                    />
                                    <rect
                                        x="195"
                                        y="236"
                                        width="18"
                                        height="20"
                                        rx="3"
                                        fill="#E58B12"
                                        stroke="#B86B08"
                                        strokeWidth="1.5"
                                    />
                                    <rect
                                        x="195"
                                        y="236"
                                        width="18"
                                        height="6"
                                        rx="2"
                                        fill="#F5A623"
                                        stroke="#B86B08"
                                        strokeWidth="1.5"
                                    />
                                    <rect x="202" y="234" width="4" height="10" rx="1.5" fill="#1E2D5A" />
                                    <rect
                                        x="194"
                                        y="266"
                                        width="22"
                                        height="18"
                                        rx="4"
                                        fill="#E58B12"
                                        stroke="#B86B08"
                                        strokeWidth="1.5"
                                    />
                                    <path
                                        d="M194 269 Q205 276 216 269"
                                        stroke="#B86B08"
                                        strokeWidth="1.5"
                                        fill="none"
                                    />
                                </g>
                                <g>
                                    <circle cx="132" cy="264" r="32" fill="url(#wristGlow)" />
                                    <path
                                        d="M126 226 C106 238 102 260 116 272 C128 280 146 276 156 266 C162 258 156 246 146 248 C138 250 130 250 128 244 Z"
                                        fill="#F6D59C"
                                    />
                                    <path
                                        d="M148 252 C158 252 164 258 162 266 C160 272 152 276 144 274"
                                        fill="#F6D59C"
                                        stroke="#DDA864"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                    />
                                    <rect
                                        x="120"
                                        y="248"
                                        width="18"
                                        height="24"
                                        rx="5"
                                        transform="rotate(-18 129 260)"
                                        fill="#1E2D5A"
                                    />
                                    <rect
                                        x="123"
                                        y="250"
                                        width="20"
                                        height="18"
                                        rx="4"
                                        transform="rotate(-18 133 259)"
                                        fill="#4DF0F7"
                                        stroke="#04A5AD"
                                        strokeWidth="2"
                                    />
                                    <rect
                                        x="129"
                                        y="254"
                                        width="4"
                                        height="4"
                                        rx="1"
                                        transform="rotate(-18 131 256)"
                                        fill="#FFFFFF"
                                        opacity="0.9"
                                    />
                                    <rect
                                        x="135"
                                        y="257"
                                        width="3"
                                        height="3"
                                        rx="0.8"
                                        transform="rotate(-18 136 258)"
                                        fill="#FFFFFF"
                                        opacity="0.75"
                                    />
                                    <rect
                                        x="128"
                                        y="260"
                                        width="5"
                                        height="2.5"
                                        rx="1"
                                        transform="rotate(-18 130 261)"
                                        fill="#025F65"
                                        opacity="0.65"
                                    />
                                </g>
                                <g>
                                    <path
                                        d="M110 164 C104 140 124 114 172 114 C220 114 240 140 234 164 C238 172 242 182 234 192 C226 212 202 224 172 224 C142 224 118 212 110 192 C102 182 106 172 110 164 Z"
                                        fill="#F6D59C"
                                    />
                                    <ellipse cx="172" cy="198" rx="38" ry="20" fill="#FFF2D6" opacity="0.65" />
                                    <g>
                                        <ellipse cx="144" cy="172" rx="13" ry="15" fill="#1E2D5A" />
                                        <circle cx="148" cy="166" r="5" fill="#FFFFFF" />
                                        <circle cx="140" cy="176" r="2" fill="#FFFFFF" opacity="0.7" />
                                        <ellipse cx="200" cy="172" rx="13" ry="15" fill="#1E2D5A" />
                                        <circle cx="204" cy="166" r="5" fill="#FFFFFF" />
                                        <circle cx="196" cy="176" r="2" fill="#FFFFFF" opacity="0.7" />
                                    </g>
                                    <path
                                        d="M132 153 Q144 147 154 152"
                                        stroke="#1E2D5A"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        fill="none"
                                    />
                                    <path
                                        d="M190 152 Q200 147 212 153"
                                        stroke="#1E2D5A"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        fill="none"
                                    />
                                    <ellipse cx="126" cy="186" rx="9" ry="5" fill="#F29E74" opacity="0.45" />
                                    <ellipse cx="218" cy="186" rx="9" ry="5" fill="#F29E74" opacity="0.45" />
                                    <path d="M166 184 Q172 181 178 184 L172 191 Z" fill="#1E2D5A" />
                                    <path
                                        d="M158 195 Q165 203 172 195 Q179 203 186 195"
                                        stroke="#7A4A28"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        fill="none"
                                    />
                                    <line
                                        x1="102"
                                        y1="176"
                                        x2="118"
                                        y2="180"
                                        stroke="#1E2D5A"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                    />
                                    <line
                                        x1="100"
                                        y1="186"
                                        x2="117"
                                        y2="186"
                                        stroke="#1E2D5A"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                    />
                                    <line
                                        x1="226"
                                        y1="180"
                                        x2="242"
                                        y2="176"
                                        stroke="#1E2D5A"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                    />
                                    <line
                                        x1="227"
                                        y1="186"
                                        x2="244"
                                        y2="186"
                                        stroke="#1E2D5A"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                    />
                                </g>
                                <g>
                                    <path
                                        d="M118 134 C120 96 140 82 172 82 C204 82 224 96 226 134 Z"
                                        fill="url(#hatGrad)"
                                    />
                                    <path
                                        d="M119 124 Q172 114 225 124 L226 136 Q172 126 118 136 Z"
                                        fill="#E5A952"
                                    />
                                    <path
                                        d="M90 148 C110 124 234 124 254 148 C258 153 250 158 238 153 C202 140 142 140 106 153 C94 158 86 153 90 148 Z"
                                        fill="#1E2D5A"
                                    />
                                    <path
                                        d="M104 151 C140 138 204 138 240 151"
                                        stroke="#364C8E"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        fill="none"
                                    />
                                    <g transform="translate(200, 104) rotate(12)">
                                        <path
                                            d="M10 0 L14 6 L20 4 L17 11 L22 15 L15 17 L13 22 L10 18 L7 22 L5 17 L-2 15 L3 11 L0 4 L6 6 Z"
                                            fill="#E3235B"
                                        />
                                        <line
                                            x1="10"
                                            y1="6"
                                            x2="10"
                                            y2="25"
                                            stroke="#B81847"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                        />
                                    </g>
                                </g>
                            </svg>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════ TRUST STRIP ═══════ */}
            <div className="pk-trust">
                <div className="pk-trust-row">
                    <div className="pk-trust-item">
                        <div className="pk-trust-num">20</div>
                        <div className="pk-trust-lbl">Maks. siswa per sesi</div>
                    </div>
                    <div className="pk-trust-item">
                        <div className="pk-trust-num">Stage</div>
                        <div className="pk-trust-lbl">Cerita &amp; Challenge</div>
                    </div>
                    <div className="pk-trust-item">
                        <div className="pk-trust-num">100%</div>
                        <div className="pk-trust-lbl">Dipandu guru langsung</div>
                    </div>
                    <div className="pk-trust-item">
                        <div className="pk-trust-num">SD–SMP</div>
                        <div className="pk-trust-lbl">Semua jenjang</div>
                    </div>
                </div>
            </div>

            {/* ═══════ FEATURES ═══════ */}
            <section className="pk-features" id="fitur">
                <div className="pk-wrap">
                    <div className="pk-section-head">
                        <h2>Belajar coding lewat petualangan seru</h2>
                        <p>
                            Bukan cuma menonton. Anak-anak ikut memilih, mencoba, dan melihat hasil
                            kodenya.
                        </p>
                    </div>

                    <div className="pk-feature-zig">
                        {/* ROW 1 — Story */}
                        <div className="pk-zig-row">
                            <div>
                                <div className="pk-zig-num" style={{background: 'var(--teal)'}}>
                                    1
                                </div>
                                <div className="pk-zig-label">Cerita Bergerak &amp; Suara</div>
                                <h3 className="pk-zig-h3">
                                    Karakter berjalan, cerita terus maju, dan suara membuat setiap
                                    misi terasa hidup
                                </h3>
                                <p className="pk-zig-body">
                                    Sebelum menyusun kode, siswa menyaksikan <em>cerita animasi</em>{' '}
                                    dengan dialog, musik latar, dan karakter yang bergerak mengikuti
                                    alur waktu. Mereka tahu <em>mengapa</em> tantangan ini penting.
                                </p>
                            </div>
                            <div>
                                <div className="pk-story-card">
                                    <div className="pk-story-top">
                                        <div className="pk-story-top-dots">
                                            <div className="pk-std" style={{background: '#e3235b'}} />
                                            <div className="pk-std" style={{background: '#F5A623'}} />
                                            <div className="pk-std" style={{background: '#04a5ad'}} />
                                        </div>
                                        <span className="ml-1.5 text-xs font-bold text-slate-400">
                                            Stage 1 — Cerita
                                        </span>
                                    </div>
                                    <div className="pk-story-bubble-wrap">
                                        <div className="pk-story-char">🐰</div>
                                        <div className="pk-story-bubble">
                                            &ldquo;Kita harus seberangi hutan sebelum malam tiba…
                                            ikuti aku!&rdquo; 🌙
                                        </div>
                                    </div>
                                    <div className="pk-story-timeline">
                                        <div className="pk-tl-bar">
                                            <div className="pk-tl-fill" />
                                        </div>
                                        <span className="pk-tl-label">♪ 0:34 / 1:12</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ROW 2 — Block coding */}
                        <div className="pk-zig-row reverse">
                            <div>
                                <div className="pk-zig-num" style={{background: 'var(--coral)'}}>
                                    2
                                </div>
                                <div className="pk-zig-label">Tantangan Blok Interaktif</div>
                                <h3 className="pk-zig-h3">
                                    Susun blok perintah untuk melewati labirin dan mengantarkan
                                    karakter ke tujuan
                                </h3>
                                <p className="pk-zig-body">
                                    Satu blok, satu langkah baru. Siswa <em>drag dan drop</em> blok
                                    MAJU, BELOK, dan LOMPAT untuk membawa Kelinci melewati peta 2D —
                                    tanpa perlu mengetik, tapi logikanya nyata.
                                </p>
                            </div>
                            <div>
                                <div className="pk-block-card">
                                    <div className="mb-4 flex items-center gap-2">
                                        <div className="pk-std" style={{background: '#e3235b'}} />
                                        <div className="pk-std" style={{background: '#F5A623'}} />
                                        <div className="pk-std" style={{background: '#7ed957'}} />
                                        <span className="ml-2 text-xs font-bold text-white/40">
                                            Editor Blok
                                        </span>
                                    </div>
                                    <div className="pk-block-editor">
                                        <div className="pk-blk pk-blk-maju">
                                            <span>→</span> MAJU 2 langkah
                                            <span className="pk-blk-drag">⠿</span>
                                        </div>
                                        <div className="pk-blk pk-blk-belok">
                                            <span>↷</span> BELOK KANAN
                                            <span className="pk-blk-drag">⠿</span>
                                        </div>
                                        <div className="pk-blk pk-blk-lompat">
                                            <span>↑</span> LOMPAT
                                            <span className="pk-blk-drag">⠿</span>
                                        </div>
                                    </div>
                                    <div className="pk-blk-map">
                                        <div className="pk-mc" />
                                        <div className="pk-mc char">🐰</div>
                                        <div className="pk-mc" />
                                        <div className="pk-mc" />
                                        <div className="pk-mc goal">🏁</div>
                                        <div className="pk-mc" />
                                        <div className="pk-mc wall" />
                                        <div className="pk-mc" />
                                        <div className="pk-mc wall" />
                                        <div className="pk-mc" />
                                        <div className="pk-mc" />
                                        <div className="pk-mc" />
                                        <div className="pk-mc wall" />
                                        <div className="pk-mc" />
                                        <div className="pk-mc" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ROW 3 — Live */}
                        <div className="pk-zig-row">
                            <div>
                                <div className="pk-zig-num" style={{background: 'var(--navy)'}}>
                                    3
                                </div>
                                <div className="pk-zig-label">Kontrol Layar Kelas Live</div>
                                <h3 className="pk-zig-h3">
                                    Guru memandu tiap tahap, dan layar sampai 20 siswa tetap
                                    tersinkron sepanjang sesi
                                </h3>
                                <p className="pk-zig-body">
                                    Dibimbing guru · Maks. 20 siswa. Guru pindah tahap, semua siswa
                                    ikut — <em>tidak ada yang bisa loncat sendiri</em> atau
                                    ketinggalan. Satu kelas, satu petualangan.
                                </p>
                            </div>
                            <div>
                                <div className="pk-live-card">
                                    <div className="pk-live-teacher-badge">
                                        <div className="pk-live-dot" />
                                        Guru memimpin · Stage 2
                                    </div>
                                    <div className="mb-2.5 text-xs font-bold text-white/50">
                                        Progres sesi
                                    </div>
                                    <div className="pk-live-stage-bar">
                                        <div className="pk-lsb done" />
                                        <div className="pk-lsb active" />
                                        <div className="pk-lsb" />
                                    </div>
                                    <LiveScreensPreviewGrid />
                                    <div className="mt-3 text-center text-xs font-bold text-white/50">
                                        Semua layar tersinkron ✓
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════ STEPS ═══════ */}
            <section className="pk-steps-section" id="cara">
                <div className="pk-wrap">
                    <div className="pk-section-head">
                        <h2>Satu kelas, melangkah bersama</h2>
                        <p>Ditemani guru, setiap anak tahu ke mana harus melangkah berikutnya.</p>
                    </div>
                    <div className="pk-steps-grid">
                        <div className="pk-step-card">
                            <div className="pk-step-num-badge">01</div>
                            <div className="pk-step-icon" style={{background: 'rgba(4,165,173,.2)'}}>
                                🔑
                            </div>
                            <h4 className="pk-step-h4">Guru membagikan kode kelas</h4>
                            <p className="pk-step-body">
                                Guru mengirim kode undangan yang tepat untuk kelasmu. Tidak ada link
                                publik, tidak ada pendaftaran terbuka.
                            </p>
                        </div>

                        <div className="pk-step-card">
                            <div className="pk-step-num-badge">02</div>
                            <div className="pk-step-icon" style={{background: 'rgba(227,35,91,.2)'}}>
                                👤
                            </div>
                            <h4 className="pk-step-h4">Masuk dengan akun dari guru</h4>
                            <p className="pk-step-body">
                                Gunakan akun siswa yang sudah disiapkan guru — tanpa pendaftaran
                                umum. Masuk, lalu masukkan kode kelas.
                            </p>
                        </div>

                        <div className="pk-step-card">
                            <div className="pk-step-num-badge">03</div>
                            <div className="pk-step-icon" style={{background: 'rgba(245,166,35,.2)'}}>
                                🚀
                            </div>
                            <h4 className="pk-step-h4">Ikuti tahap live bersama</h4>
                            <p className="pk-step-body">
                                Dengarkan cerita, susun blok, lalu rayakan misi yang berhasil
                                diselesaikan bersama kelas.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════ CTA BAND ═══════ */}
            <section className="pk-cta-band">
                <div className="pk-wrap">
                    <h2>Siap memulai petualangan?</h2>
                    <p>Masuk ke akun yang diberikan guru, lalu ikuti kelasmu bersama teman-teman.</p>
                    <Link href={dashboardHref} className="pk-btn-cta-big">
                        {dashboardLabel} →
                    </Link>
                </div>
            </section>

            {/* ═══════ FOOTER ═══════ */}
            <footer className="pk-footer">
                <div className="pk-wrap">
                    <div className="pk-footer-grid">
                        <div>
                            <div className="pk-footer-logo">
                                Petualang<span>Kode</span>
                            </div>
                            <p className="pk-footer-desc">
                                Platform coding live untuk anak SD dan SMP — seru, terarah, dan aman.
                            </p>
                            <div className="pk-footer-note">
                                <strong>Tentang akun siswa:</strong> Akun siswa dibuat dan dikelola
                                oleh guru atau admin. Pendaftaran umum tidak tersedia.
                            </div>
                        </div>
                        <div className="pk-footer-col">
                            <div className="pk-footer-col-h">Platform</div>
                            <a href="#fitur">Petualangan</a>
                            <a href="#cara">Cara belajar</a>
                            <Link href="/masuk">Masuk</Link>
                        </div>
                        <div className="pk-footer-col">
                            <div className="pk-footer-col-h">Petualang Kode</div>
                            <Link href="/masuk?tab=admin">Panel Pengajar (Admin)</Link>
                        </div>
                    </div>
                    <div className="pk-footer-bottom">
                        <span className="pk-footer-copy">
                            © 2026 Petualang Kode. Dibuat untuk anak-anak Indonesia.
                        </span>
                        <span className="pk-footer-live">Platform aktif</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
