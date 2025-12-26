"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../ThemeContext";

// --- Types ---
interface QuakeData {
    id: string;
    time: string;
    code: number;
    earthquake: {
        time: string;
        hypocenter: {
            name: string;
            latitude: number;
            longitude: number;
            depth: number;
            magnitude: number;
        };
        maxScale: number;
    };
    issue: {
        time: string;
        type: string;
    };
}

// Separate Map Component to handle Leaflet loading
function LeafletMap({ quakes }: { quakes: QuakeData[] }) {
    const mapRef = useRef<HTMLDivElement>(null);
    const okinawaMapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const okinawaMapInstanceRef = useRef<any>(null);
    const [leafletLoaded, setLeafletLoaded] = useState(false);
    const initAttemptRef = useRef(0);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Function to invalidate map size (fix white screen issue)
    const invalidateMaps = useCallback(() => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
        }
        if (okinawaMapInstanceRef.current) {
            okinawaMapInstanceRef.current.invalidateSize();
        }
    }, []);

    // --- Dynamic initialization logic ---
    const tryInitMap = useCallback(async () => {
        if (typeof window === "undefined" || !mapRef.current || !isMountedRef.current) return;

        // Increase attempt counter to track this specific call
        initAttemptRef.current += 1;
        const currentAttempt = initAttemptRef.current;

        // Make sure container has dimensions before initializing
        const containerRect = mapRef.current.getBoundingClientRect();
        if (containerRect.width === 0 || containerRect.height === 0) {
            return;
        }

        // Dynamically import Leaflet
        const L = (await import("leaflet")).default;

        // Add Leaflet CSS dynamically if not present
        if (!document.getElementById("leaflet-css")) {
            const link = document.createElement("link");
            link.id = "leaflet-css";
            link.rel = "stylesheet";
            link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
            document.head.appendChild(link);

            // Wait for CSS or timeout
            await new Promise<void>((resolve) => {
                link.onload = () => resolve();
                link.onerror = () => resolve();
                setTimeout(resolve, 1000);
            });
        }

        // Check if we were preempted or unmounted during async operations
        if (!isMountedRef.current || !mapRef.current || currentAttempt !== initAttemptRef.current) return;

        setLeafletLoaded(true);

        // cleanup function to be used before new init or on unmount
        const cleanupMaps = () => {
            if (mapInstanceRef.current) {
                try {
                    mapInstanceRef.current.off();
                    mapInstanceRef.current.remove();
                } catch (e) { console.warn("Map remove error", e); }
                mapInstanceRef.current = null;
            }
            if (okinawaMapInstanceRef.current) {
                try {
                    okinawaMapInstanceRef.current.off();
                    okinawaMapInstanceRef.current.remove();
                } catch (e) { }
                okinawaMapInstanceRef.current = null;
            }
        };

        // Clean up existing map instances before creating new ones
        cleanupMaps();


        const isMobile = window.innerWidth < 768;
        const mobileCenter: [number, number] = [36.5, 138];
        const desktopCenter: [number, number] = [37.0, 138.5];
        const mobileZoom = 5;
        const desktopZoom = 6;

        try {
            // 1. Main Map (Japan Mainland)
            const map = L.map(mapRef.current!, {
                center: isMobile ? mobileCenter : desktopCenter,
                zoom: isMobile ? mobileZoom : desktopZoom,
                scrollWheelZoom: false,
                zoomControl: false,
                attributionControl: false
            });

            L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                subdomains: 'abcd',
                maxZoom: 19
            }).addTo(map);

            // 2. Okinawa/Ogasawara Inset Map
            if (okinawaMapRef.current) {
                const okMap = L.map(okinawaMapRef.current!, {
                    center: [26.2, 127.7],
                    zoom: 4,
                    scrollWheelZoom: false,
                    zoomControl: false,
                    dragging: false,
                    touchZoom: false,
                    doubleClickZoom: false,
                    attributionControl: false
                });

                L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png").addTo(okMap);
                okinawaMapInstanceRef.current = okMap;
            }

            // Define custom icon generators
            const getIcon = (scale: number) => {
                let color = "#3b82f6"; // Default Blue
                let size = 20;
                let pulseSize = "w-2 h-2";

                if (scale >= 30) { color = "#3b82f6"; size = 24; pulseSize = "w-2.5 h-2.5"; }
                if (scale >= 40) { color = "#fbbf24"; size = 30; pulseSize = "w-3 h-3"; } // Shindo 4 (Yellow)
                if (scale >= 45) { color = "#f59e0b"; size = 38; pulseSize = "w-4 h-4"; } // Shindo 5- (Orange)
                if (scale >= 55) { color = "#ef4444"; size = 46; pulseSize = "w-5 h-5"; } // Shindo 6- (Red)
                if (scale >= 70) { color = "#7c3aed"; size = 56; pulseSize = "w-6 h-6"; } // Shindo 7 (Purple)

                return L.divIcon({
                    className: "custom-div-icon",
                    html: `<div class="rounded-full flex items-center justify-center shadow-2xl border-2 border-white/60 transition-all duration-500" 
                                style="background-color: ${color}; width: ${size}px; height: ${size}px;">
                            <div class="${pulseSize} rounded-full bg-white animate-ping"></div>
                          </div>`,
                    iconSize: [size, size],
                    iconAnchor: [size / 2, size / 2]
                });
            };

            // Add markers
            quakes.forEach((quake) => {
                const { latitude: lat, longitude: lon } = quake.earthquake.hypocenter;
                if (lat && lon) {
                    const icon = getIcon(quake.earthquake.maxScale);
                    const marker = L.marker([lat, lon], { icon }).addTo(map);

                    marker.bindPopup(`
                        <div class="p-2 text-slate-800">
                            <strong class="text-sm">${quake.earthquake.hypocenter.name}</strong><br/>
                            <span class="text-xs">M ${quake.earthquake.hypocenter.magnitude} | 深度 ${quake.earthquake.hypocenter.depth}km</span><br/>
                            <span class="text-xs font-bold text-red-500">最大震度 ${quake.earthquake.maxScale / 10}</span>
                        </div>
                    `);

                    // Also add to Okinawa map if in that region
                    if (lat < 30 && okinawaMapInstanceRef.current) {
                        L.marker([lat, lon], { icon }).addTo(okinawaMapInstanceRef.current);
                    }
                }
            });

            mapInstanceRef.current = map;

            // Final layout fix - multiple calls to ensure tiles are ready
            setTimeout(invalidateMaps, 100);
            setTimeout(invalidateMaps, 500);

        } catch (error) {
            console.error("Failed to initialize Leaflet map:", error);
        }
    }, [quakes, invalidateMaps]);

    // Track initialization requirement
    useEffect(() => {
        tryInitMap();
    }, [tryInitMap]);

    // --- Observors for visibility/layout ---
    useEffect(() => {
        if (!mapRef.current || !okinawaMapRef.current) return;

        const resizeObserver = new ResizeObserver(() => {
            // Just trigger a refresh on any resize of the main container
            setTimeout(invalidateMaps, 100);
        });

        resizeObserver.observe(mapRef.current);
        return () => resizeObserver.disconnect();
    }, [invalidateMaps]);

    useEffect(() => {
        if (!mapRef.current) return;

        const intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    if (!mapInstanceRef.current) {
                        tryInitMap();
                    } else {
                        setTimeout(invalidateMaps, 100);
                        setTimeout(invalidateMaps, 600);
                    }
                }
            });
        }, { threshold: 0.1 });

        intersectionObserver.observe(mapRef.current);
        return () => intersectionObserver.disconnect();
    }, [tryInitMap, invalidateMaps]);

    return (
        <div className="relative w-full h-full min-h-[400px] md:min-h-[500px] bg-slate-900 rounded-[32px] overflow-hidden border border-white/5 shadow-lg group">
            <div ref={mapRef} className="w-full h-full z-0" />

            {/* Okinawa Inset - Bottom Right */}
            <div className="absolute bottom-4 right-4 w-32 h-40 md:w-40 md:h-52 bg-slate-950/90 backdrop-blur-md rounded-2xl border border-white/10 z-10 overflow-hidden shadow-2xl">
                <div ref={okinawaMapRef} className="w-full h-full grayscale opacity-60" />
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 rounded-full text-[10px] text-white/70 font-bold backdrop-blur-sm">
                    沖縄・小笠原
                </div>
            </div>

            {/* Map Controls - Top Left */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                <button
                    onClick={() => mapInstanceRef.current?.zoomIn()}
                    className="p-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl border border-white/10 backdrop-blur-md transition-all active:scale-90"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
                <button
                    onClick={() => mapInstanceRef.current?.zoomOut()}
                    className="p-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl border border-white/10 backdrop-blur-md transition-all active:scale-90"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                    </svg>
                </button>
            </div>

            {/* Loading Cover */}
            {!leafletLoaded && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center flex-col gap-4">
                    <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Main View Component ---
export default function EarthquakeView() {
    const { settings } = useTheme();
    const [quakes, setQuakes] = useState<QuakeData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQuakes = async () => {
            try {
                // Fetch more to ensure we have enough after filtering
                // Fetch 100 to ensure 10 after filtering
                const res = await fetch("https://api.p2pquake.net/v2/history?codes=551&limit=100");
                const data = await res.json();
                if (Array.isArray(data)) {
                    // Filter: Magnitude >= 3 AND Max Intensity >= 3 (scale 30+)
                    const filteredData = data
                        .filter((q: any) =>
                            q.earthquake.hypocenter.magnitude >= 3 &&
                            q.earthquake.maxScale >= 30
                        )
                        .slice(0, 10); // Keep exactly 10 if possible
                    setQuakes(filteredData);
                }
            } catch (error) {
                console.error("Failed to fetch earthquake data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchQuakes();

        const interval = setInterval(fetchQuakes, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const m = date.getMonth() + 1;
        const d = date.getDate();
        const h = date.getHours().toString().padStart(2, '0');
        const min = date.getMinutes().toString().padStart(2, '0');
        const scStr = `${m}月${d}日 ${h}:${min}`;
        const tcStr = `${m}月${d}日 ${h}:${min}`;
        return settings.lang === "sc" ? scStr : tcStr;
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-6 bg-slate-950/85 rounded-[40px] border border-white/5 relative overflow-hidden shadow-2xl">
            {/* Left: Map */}
            <div className="flex-[2] min-h-[400px] md:min-h-[600px]">
                <LeafletMap quakes={quakes} />
            </div>

            {/* Right: List */}
            <div className="flex-1 flex flex-col gap-4 max-h-[600px] relative z-10">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                        <div className="w-2 h-6 bg-red-500 rounded-full" />
                        {settings.lang === "sc" ? "强震记录" : "強震記錄"}
                    </h3>
                    <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
                        <span className="text-red-500 text-[10px] font-black animate-pulse">LIVE RECAP</span>
                    </div>
                </div>

                <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
                    {loading ? (
                        [0, 1, 2].map(i => (
                            <div key={i} className="h-24 bg-white/5 rounded-3xl animate-pulse" />
                        ))
                    ) : quakes.length > 0 ? (
                        quakes.map((quake) => (
                            <div
                                key={quake.id}
                                className="group p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-[28px] transition-all"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-sm font-black text-white/80 group-hover:text-white transition-colors">
                                        {quake.earthquake.hypocenter.name}
                                    </span>
                                    <span className="text-[10px] font-bold text-white/30">
                                        {formatDate(quake.earthquake.time)}
                                    </span>
                                </div>
                                <div className="flex items-end gap-6">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{settings.lang === "sc" ? "震级" : "震級"}</span>
                                        <span className="text-2xl font-black text-white italic">M{quake.earthquake.hypocenter.magnitude}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{settings.lang === "sc" ? "最大震度" : "最大震度"}</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className={`text-3xl font-black ${quake.earthquake.maxScale >= 45 ? 'text-red-500' : 'text-amber-500'}`}>
                                                {quake.earthquake.maxScale / 10}
                                            </span>
                                            <span className="text-[10px] font-bold text-white/20">{settings.lang === "sc" ? "级" : "級"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4">
                            <span className="text-xs font-bold uppercase tracking-widest">暂无记录</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
