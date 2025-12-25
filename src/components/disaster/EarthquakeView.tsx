"use client";

import { useState, useEffect, useRef } from "react";
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

    useEffect(() => {
        if (typeof window === "undefined" || !mapRef.current) return;

        // Dynamically import Leaflet only on client side
        const initMap = async () => {
            const L = (await import("leaflet")).default;

            // Add Leaflet CSS dynamically
            if (!document.getElementById("leaflet-css")) {
                const link = document.createElement("link");
                link.id = "leaflet-css";
                link.rel = "stylesheet";
                link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
                document.head.appendChild(link);
            }

            // Wait for CSS to load
            await new Promise(resolve => setTimeout(resolve, 100));

            // Initialize main map
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
            }

            const isMobile = window.innerWidth < 768;
            const mobileCenter: [number, number] = [36.5, 138]; // Slightly adjusted for portrait
            const desktopCenter: [number, number] = [37.0, 138.5];
            const mobileZoom = 5; // Zoom out slightly on mobile to fit width
            const desktopZoom = 6;

            const map = L.map(mapRef.current!, {
                center: isMobile ? mobileCenter : desktopCenter,
                zoom: isMobile ? mobileZoom : desktopZoom,
                scrollWheelZoom: false,
                zoomControl: false,
                attributionControl: false,
            });

            // Dark theme tiles from CARTO
            L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
                attribution: '&copy; CARTO',
            }).addTo(map);

            // Helper function to add markers
            const addMarkers = (targetMap: any, filterOkinawa: boolean) => {
                quakes.slice(0, 10).forEach((q) => {
                    const lat = q.earthquake.hypocenter.latitude;
                    const lon = q.earthquake.hypocenter.longitude;
                    const mag = q.earthquake.hypocenter.magnitude;
                    const name = q.earthquake.hypocenter.name;
                    const depth = q.earthquake.hypocenter.depth;
                    const time = q.earthquake.time;

                    if (!lat || !lon) return;

                    // Filter for Okinawa region (lat < 28)
                    const isOkinawa = lat < 28;
                    if (filterOkinawa && !isOkinawa) return;
                    if (!filterOkinawa && isOkinawa) return;

                    // Color based on magnitude - MUST match getMagColor below
                    let color = "#EAB308"; // yellow-500 (default for M3-3.9)
                    let radius = filterOkinawa ? 5 : 6;
                    if (mag >= 6.0) {
                        color = "#EF4444"; // red-500
                        radius = filterOkinawa ? 10 : 14;
                    } else if (mag >= 4.0) {
                        color = "#F97316"; // orange-500
                        radius = filterOkinawa ? 7 : 9;
                    }

                    const circle = L.circleMarker([lat, lon], {
                        radius: radius,
                        fillColor: color,
                        fillOpacity: 0.7,
                        color: color,
                        weight: 2,
                        opacity: 1,
                    });

                    circle.bindPopup(`
                        <div style="font-size: 14px;">
                            <b>${name}</b><br/>
                            M${mag.toFixed(1)} · 深さ${depth}km<br/>
                            <span style="color: #888; font-size: 12px;">${time}</span>
                        </div>
                    `);

                    circle.addTo(targetMap);
                });
            };

            // Add markers to main map (excluding Okinawa)
            addMarkers(map, false);
            mapInstanceRef.current = map;

            // Initialize Okinawa inset map
            if (okinawaMapRef.current) {
                if (okinawaMapInstanceRef.current) {
                    okinawaMapInstanceRef.current.remove();
                }

                const okinawaMap = L.map(okinawaMapRef.current!, {
                    center: [26.2, 127.7], // Okinawa center
                    zoom: 7,
                    scrollWheelZoom: false,
                    zoomControl: false,
                    attributionControl: false,
                    dragging: false,
                });

                L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
                    attribution: '&copy; CARTO',
                }).addTo(okinawaMap);

                // Add markers to Okinawa map
                addMarkers(okinawaMap, true);
                okinawaMapInstanceRef.current = okinawaMap;
            }
        };

        initMap();

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
            if (okinawaMapInstanceRef.current) {
                okinawaMapInstanceRef.current.remove();
                okinawaMapInstanceRef.current = null;
            }
        };
    }, [quakes]);

    // Zoom Control
    const [zoomLevel, setZoomLevel] = useState(6);

    const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newZoom = Number(e.target.value);
        setZoomLevel(newZoom);
        if (mapInstanceRef.current) {
            mapInstanceRef.current.setZoom(newZoom);
        }
    };

    // Listen for map zoom events to update slider
    useEffect(() => {
        if (!mapInstanceRef.current) return;

        const map = mapInstanceRef.current;
        const onZoomEnd = () => {
            setZoomLevel(map.getZoom());
        };

        map.on('zoomend', onZoomEnd);
        return () => {
            map.off('zoomend', onZoomEnd);
        };
    }, [mapInstanceRef.current]);

    return (
        <div className="relative w-full h-full min-h-[500px] lg:min-h-[300px]">
            {/* Main Map */}
            <div ref={mapRef} className="w-full h-full z-0" />

            {/* Zoom Slider (Vertical) - Repositioned for mobile */}
            <div className="absolute left-3 top-1/2 -translate-y-1/2 z-[1000] w-6 flex flex-col items-center justify-center pointer-events-none">
                <div className="h-48 w-8 flex items-center justify-center p-2 rounded-full bg-white/80 dark:bg-black/60 backdrop-blur-md border border-gray-100 dark:border-white/10 shadow-lg pointer-events-auto">
                    <input
                        type="range"
                        min="4"
                        max="9"
                        step="0.1"
                        value={zoomLevel}
                        onChange={handleZoomChange}
                        className="w-40 h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer -rotate-90 origin-center accent-emerald-500"
                    />
                </div>
            </div>

            {/* Okinawa Inset Map - Smaller on mobile */}
            <div className="absolute bottom-3 right-3 lg:bottom-4 lg:right-4 z-[1000] w-28 h-28 lg:w-40 lg:h-40 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg">
                <div ref={okinawaMapRef} className="w-full h-full" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-center text-white/80 py-0.5">
                    沖縄
                </div>
            </div>
        </div>
    );
}

export default function EarthquakeView() {
    const { settings } = useTheme();
    const [data, setData] = useState<QuakeData[]>([]);
    const [loading, setLoading] = useState(true);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        async function fetchQuakes() {
            try {
                const res = await fetch("https://api.p2pquake.net/v2/history?codes=551&limit=20");
                const json = await res.json();
                const filtered = json.filter((q: QuakeData) =>
                    q.earthquake.hypocenter.magnitude >= 3.0
                );
                setData(filtered);
            } catch (error) {
                console.error("Failed to fetch quakes:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchQuakes();
    }, []);

    const majorAlert = data.find(q => {
        const timeDiff = new Date().getTime() - new Date(q.earthquake.time).getTime();
        const isRecent = timeDiff < 24 * 60 * 60 * 1000;
        const isBig = q.earthquake.maxScale >= 45 || q.earthquake.hypocenter.magnitude >= 6.0;
        return isRecent && isBig;
    });

    // Color function for list text - MUST match map marker colors
    const getMagColor = (magnitude: number) => {
        if (magnitude >= 6.0) return "text-red-500 font-bold"; // red-500
        if (magnitude >= 4.0) return "text-orange-500 font-bold"; // orange-500
        return "text-yellow-500 font-bold"; // yellow-500
    };

    return (
        <div className="flex flex-col lg:flex-row gap-4">

            {/* Map Container - 2/3 width on desktop */}
            <div className="luxury-card relative h-[500px] lg:h-auto lg:aspect-auto lg:flex-[2] w-full bg-slate-900 rounded-2xl overflow-hidden shadow-inner lg:min-h-[300px]">

                {/* HUD Status Card (Top Left) - Square Format */}
                <div className={`absolute top-4 left-4 z-[1000] w-24 h-24 flex flex-col items-center justify-center gap-2 rounded-2xl backdrop-blur-md border shadow-lg transition-all ${majorAlert
                    ? 'bg-red-500/90 border-red-400 animate-pulse'
                    : 'bg-white/80 dark:bg-black/60 border-gray-100 dark:border-white/10'
                    }`}>
                    <div className={`w-4 h-4 rounded-full ${majorAlert ? 'bg-white animate-ping' : 'bg-emerald-500'}`} />
                    <span className={`text-xs font-bold text-center leading-tight px-2 ${majorAlert ? 'text-white' : 'text-gray-600 dark:text-gray-300'
                        }`}>
                        {majorAlert
                            ? (settings.lang === "sc" ? "地震\n警报" : "地震\n警報")
                            : (settings.lang === "sc" ? "暂无\n警报" : "暫無\n警報")
                        }
                    </span>
                </div>

                {/* Leaflet Map - Only render on client */}
                {isClient && !loading && data.length > 0 ? (
                    <LeafletMap quakes={data} />
                ) : (
                    <div className="w-full h-full min-h-[300px] flex items-center justify-center text-gray-400">
                        {loading ? "読み込み中..." : "地図を準備中..."}
                    </div>
                )}

                <div className="absolute bottom-3 left-4 z-[1000] text-[10px] text-gray-400 font-mono opacity-60 bg-black/50 px-2 py-1 rounded">
                    P2P Quake + CARTO
                </div>
            </div>

            {/* Compact Recent List - Top 10 - 1/3 width on desktop */}
            <div className="luxury-card rounded-2xl bg-white overflow-hidden lg:flex-1 lg:min-h-[300px] flex flex-col">
                <div className="px-4 py-3 bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 flex justify-between items-center shrink-0">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {settings.lang === "sc" ? "地震记录" : "地震記錄"}
                    </h3>
                    <span className="text-[10px] text-gray-400">Recent 10</span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="h-full flex items-center justify-center text-xs text-gray-400">Loading data...</div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-white/5 h-full flex flex-col">
                            {data.slice(0, 10).map((q) => (
                                <div key={q.id} className="flex items-center px-4 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex-1">
                                    <span className="text-sm font-mono text-gray-400 w-24 shrink-0">
                                        {(() => {
                                            const parts = q.earthquake.time.split(' ');
                                            const datePart = parts[0]; // YYYY/MM/DD
                                            const timePart = parts[1]?.substring(0, 5) || ''; // HH:MM
                                            const dateArr = datePart.split('/');
                                            const monthDay = dateArr.length >= 3 ? `${dateArr[1]}/${dateArr[2]}` : datePart;
                                            return `${monthDay} ${timePart}`;
                                        })()}
                                    </span>
                                    <span className="flex-1 text-base font-medium text-gray-700 dark:text-gray-200 truncate px-3">
                                        {q.earthquake.hypocenter.name}
                                    </span>
                                    <span className={`text-sm w-12 text-right ${getMagColor(q.earthquake.hypocenter.magnitude)}`}>
                                        M{q.earthquake.hypocenter.magnitude.toFixed(1)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                  width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                  background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                  background-color: rgba(156, 163, 175, 0.3);
                  border-radius: 9999px;
                }
            `}</style>
        </div>
    );
}
