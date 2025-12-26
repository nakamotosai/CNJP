"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Cloud, MapPin, Loader2, CloudRain, Sun, CloudSun, Snowflake, CloudLightning, ChevronDown, Droplets, Wind, Thermometer, Umbrella } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../ThemeContext";

interface City {
    name: string;
    name_tc: string;
    lat: number;
    lon: number;
}

const CITIES: City[] = [
    { name: "东京", name_tc: "東京", lat: 35.6895, lon: 139.6917 },
    { name: "横滨", name_tc: "橫濱", lat: 35.4437, lon: 139.6380 },
    { name: "大阪", name_tc: "大阪", lat: 34.6937, lon: 135.5023 },
    { name: "京都", name_tc: "京都", lat: 35.0116, lon: 135.7681 },
    { name: "神户", name_tc: "神戶", lat: 34.6901, lon: 135.1955 },
    { name: "札幌", name_tc: "札幌", lat: 43.0618, lon: 141.3545 },
    { name: "福冈", name_tc: "福岡", lat: 33.5904, lon: 130.4017 },
    { name: "名古屋", name_tc: "名古屋", lat: 35.1815, lon: 136.9066 },
    { name: "仙台", name_tc: "仙台", lat: 38.2682, lon: 140.8694 },
    { name: "那霸", name_tc: "那霸", lat: 26.2124, lon: 127.6809 },
];

interface WeatherData {
    current_weather: {
        temperature: number;
        weathercode: number;
        windspeed: number;
        is_day: number;
    };
    daily: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        weather_code: number[];
        precipitation_probability_max: number[];
    };
    hourly: {
        relativehumidity_2m: number[];
        apparent_temperature: number[];
    };
}

export default function WeatherView({ onCityChange }: { onCityChange?: (cityName: string) => void }) {
    const { settings } = useTheme();
    const [selectedCity, setSelectedCity] = useState<City>(CITIES[0]);
    const [data, setData] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isCityMenuOpen, setIsCityMenuOpen] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Sync selected city with parent
    useEffect(() => {
        onCityChange?.(selectedCity.name);
    }, [selectedCity, onCityChange]);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsCityMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Load saved city
    useEffect(() => {
        const savedCityName = localStorage.getItem("cnjp_weather_city");
        if (savedCityName) {
            const city = CITIES.find(c => c.name === savedCityName);
            if (city) setSelectedCity(city);
        }
    }, []);

    // Fetch weather
    useEffect(() => {
        let isMounted = true;
        async function fetchWeather() {
            setLoading(true);
            try {
                // Fetch more data including humidity, apparent temp, and rain prob
                const res = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${selectedCity.lat}&longitude=${selectedCity.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&current_weather=true&hourly=relativehumidity_2m,apparent_temperature&timezone=Asia%2FTokyo`
                );
                const json = await res.json();
                if (isMounted) {
                    setData(json);
                }
            } catch (error) {
                console.error("Failed to fetch weather:", error);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }
        fetchWeather();
        return () => { isMounted = false; };
    }, [selectedCity]);

    const selectCity = (city: City) => {
        setSelectedCity(city);
        setIsCityMenuOpen(false);
        setIsSaved(false);
    };

    const handleSaveDefault = (e: React.MouseEvent) => {
        e.stopPropagation();
        localStorage.setItem("cnjp_weather_city", selectedCity.name);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    // Style helper: Get theme colors and background based on weather code
    const weatherStyle = useMemo(() => {
        if (!data) return {
            bg: "from-blue-500 to-blue-600",
            iconColor: "text-white",
            overlay: "bg-blue-600/20"
        };

        const code = data.current_weather.weathercode;
        const isDay = data.current_weather.is_day;

        // Night style
        if (!isDay) return {
            bg: "from-slate-800 to-indigo-950",
            iconColor: "text-blue-200",
            overlay: "bg-indigo-900/40"
        };

        // Clear Sky
        if (code === 0) return {
            bg: "from-amber-400 to-orange-500",
            iconColor: "text-amber-100",
            overlay: "bg-orange-600/20"
        };
        // Partly Cloudy
        if (code >= 1 && code <= 3) return {
            bg: "from-blue-400 to-indigo-500",
            iconColor: "text-blue-100",
            overlay: "bg-blue-600/20"
        };
        // Rain
        if (code >= 51 && code <= 82) return {
            bg: "from-blue-600 to-slate-700",
            iconColor: "text-blue-300",
            overlay: "bg-slate-800/40"
        };
        // Snow
        if (code >= 71 && code <= 86) return {
            bg: "from-cyan-300 to-blue-400",
            iconColor: "text-white",
            overlay: "bg-white/20"
        };
        // Thunder
        if (code >= 95) return {
            bg: "from-indigo-700 to-purple-900",
            iconColor: "text-purple-200",
            overlay: "bg-black/40"
        };

        return {
            bg: "from-gray-400 to-gray-600",
            iconColor: "text-gray-100",
            overlay: "bg-gray-800/20"
        };
    }, [data]);

    const getWeatherIcon = (code: number, size: string = "w-6 h-6", isBig = false) => {
        const glowClass = isBig ? "drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" : "";

        if (code === 0) return <Sun className={`${size} text-amber-300 ${glowClass}`} />;
        if (code >= 1 && code <= 3) return <CloudSun className={`${size} text-amber-200 ${glowClass}`} />;
        if (code >= 45 && code <= 48) return <Cloud className={`${size} text-gray-200 ${glowClass}`} />;
        if (code >= 51 && code <= 67) return <CloudRain className={`${size} text-blue-300 ${glowClass}`} />;
        if (code >= 71 && code <= 77) return <Snowflake className={`${size} text-white ${glowClass}`} />;
        if (code >= 80 && code <= 82) return <CloudRain className={`${size} text-blue-400 ${glowClass}`} />;
        if (code >= 85 && code <= 86) return <Snowflake className={`${size} text-cyan-100 ${glowClass}`} />;
        if (code >= 95) return <CloudLightning className={`${size} text-purple-300 ${glowClass}`} />;
        return <Cloud className={`${size} text-gray-300 ${glowClass}`} />;
    };

    const getDayName = (dateStr: string) => {
        const date = new Date(dateStr);
        const day = date.getDay();
        const daysSC = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
        const daysTC = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
        return settings.lang === "sc" ? daysSC[day] : daysTC[day];
    };

    return (
        <div className="w-full h-full">
            {/* Dynamic Weather Card */}
            <div className={`luxury-card relative rounded-[32px] overflow-hidden transition-all duration-700 z-20 h-full min-h-[420px] flex flex-col bg-gradient-to-br ${weatherStyle.bg} border-none shadow-2xl`}>

                {/* Decorative Pattern / Overlay */}
                <div className={`absolute inset-0 opacity-30 pointer-events-none ${weatherStyle.overlay} mix-blend-overlay`} />

                {/* 1. Header: Location & Date - Use z-30 to ensure menu is on top */}
                <div className="relative px-8 pt-8 pb-4 flex items-center justify-between z-30 shrink-0">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setIsCityMenuOpen(!isCityMenuOpen)}>
                            <MapPin className="w-6 h-6 text-white/70 group-hover:text-white transition-colors" />
                            <h2 className="text-4xl font-bold text-white tracking-tight">
                                {settings.lang === "sc" ? selectedCity.name : selectedCity.name_tc}
                            </h2>
                            <ChevronDown className={`w-6 h-6 text-white/70 transition-transform duration-300 ${isCityMenuOpen ? 'rotate-180' : ''}`} />
                        </div>
                        <button
                            onClick={handleSaveDefault}
                            className={`mt-2 text-xs px-3 py-1 rounded-full transition-all w-fit flex items-center gap-1 backdrop-blur-md border border-white/10 ${isSaved
                                ? "bg-green-500/40 text-white"
                                : "text-white/80 bg-white/10 hover:bg-white/20"
                                }`}
                        >
                            {isSaved ? (
                                <><span>✓</span><span>{settings.lang === "sc" ? "已默认" : "已默認"}</span></>
                            ) : (
                                <span>{settings.lang === "sc" ? "设为默认" : "設為默認"}</span>
                            )}
                        </button>

                        <AnimatePresence>
                            {isCityMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute top-24 left-0 w-72 p-4 bg-black/60 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 z-50 grid grid-cols-2 gap-2"
                                >
                                    <h3 className="col-span-2 text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 px-1">
                                        {settings.lang === "sc" ? "选择城市" : "選擇城市"}
                                    </h3>
                                    {CITIES.map(city => (
                                        <button
                                            key={city.name}
                                            onClick={() => selectCity(city)}
                                            className={`px-3 py-2 text-xs font-bold rounded-xl transition-all border ${selectedCity.name === city.name
                                                ? "bg-white text-black border-white shadow-lg"
                                                : "bg-white/5 text-white/80 border-transparent hover:bg-white/10"
                                                }`}
                                        >
                                            {settings.lang === "sc" ? city.name : city.name_tc}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="text-right flex flex-col items-end">
                        <div className="text-sm font-bold text-white/90 bg-black/10 px-3 py-1 rounded-full backdrop-blur-sm">
                            {new Date().toLocaleDateString(settings.lang === 'sc' ? 'zh-CN' : 'zh-TW', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                    </div>
                </div>

                {/* 2. Current Weather Big View */}
                <div className="px-8 py-4 flex flex-col items-center justify-center flex-1 z-10">
                    {loading ? (
                        <div className="flex-1 w-full flex items-center justify-center">
                            <Loader2 className="w-10 h-10 animate-spin text-white/30" />
                        </div>
                    ) : data ? (
                        <div className="w-full flex flex-col items-center">
                            <div className="flex items-center gap-10">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                    className="drop-shadow-2xl"
                                >
                                    {getWeatherIcon(data.current_weather.weathercode, "w-40 h-40", true)}
                                </motion.div>
                                <div className="flex flex-col items-start">
                                    <div className="flex items-start">
                                        <span className="text-9xl font-bold tracking-tighter text-white leading-none">
                                            {Math.round(data.current_weather.temperature)}
                                        </span>
                                        <span className="text-5xl font-light text-white/80 mt-2">°</span>
                                    </div>
                                    <span className="text-xl font-medium text-white/60 tracking-wider">
                                        {settings.lang === "sc" ? "当前气温" : "當前氣溫"}
                                    </span>
                                </div>
                            </div>

                            {/* Additional Info Pills */}
                            <div className="flex flex-wrap justify-center gap-3 mt-8">
                                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                                    <Droplets className="w-4 h-4 text-blue-300" />
                                    <span className="text-sm font-bold text-white/90">{data.hourly.relativehumidity_2m[0]}%</span>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                                    <Thermometer className="w-4 h-4 text-orange-300" />
                                    <span className="text-sm font-bold text-white/90">
                                        {settings.lang === "sc" ? "体感" : "體感"} {Math.round(data.hourly.apparent_temperature[0])}°
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                                    <Wind className="w-4 h-4 text-teal-300" />
                                    <span className="text-sm font-bold text-white/90">{data.current_weather.windspeed} km/h</span>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* 3. Hourly / Daily Info Bar */}
                {data && !loading && (
                    <div className="px-8 pb-4 z-10 flex justify-center">
                        <div className="flex items-center gap-2 text-white/60 text-xs font-bold uppercase tracking-widest bg-black/10 px-4 py-1.5 rounded-full backdrop-blur-sm">
                            <Umbrella className="w-4 h-4" />
                            <span>{settings.lang === "sc" ? "今日降水概率" : "今日降水概率"}: {data.daily.precipitation_probability_max[0]}%</span>
                        </div>
                    </div>
                )}

                {/* 4. 5-Day Forecast Row */}
                <div className="p-6 bg-black/20 backdrop-blur-xl shrink-0 z-10">
                    {loading ? (
                        <div className="h-20 flex items-center justify-center">
                            <div className="flex gap-1">
                                {[0, 1, 2].map(i => (
                                    <motion.div
                                        key={i}
                                        animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }}
                                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                                        className="w-1.5 h-1.5 bg-white/30 rounded-full"
                                    />
                                ))}
                            </div>
                        </div>
                    ) : data ? (
                        <div className="grid grid-cols-5 gap-2">
                            {data.daily.time.slice(0, 5).map((time, i) => (
                                <motion.div
                                    key={time}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className={`flex flex-col items-center gap-2 p-2 rounded-2xl border transition-colors ${i === 0 ? 'bg-white/15 border-white/20' : 'bg-transparent border-transparent'}`}
                                >
                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${i === 0 ? 'text-white' : 'text-white/40'}`}>
                                        {i === 0 ? (settings.lang === "sc" ? "TODAY" : "TODAY") : getDayName(time)}
                                    </span>
                                    <div className="py-1">
                                        {getWeatherIcon(data.daily.weather_code[i], "w-8 h-8")}
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-sm font-black text-white">{Math.round(data.daily.temperature_2m_max[i])}°</span>
                                        <span className="text-[10px] font-bold text-white/40">{Math.round(data.daily.temperature_2m_min[i])}°</span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : null}
                </div>

            </div>
        </div>
    );
}
