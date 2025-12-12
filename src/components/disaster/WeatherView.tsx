"use client";

import { useState, useEffect, useRef } from "react";
import { Cloud, MapPin, Loader2, CloudRain, Sun, CloudSun, Snowflake, CloudLightning, ChevronDown } from "lucide-react";
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
    };
    daily: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        weather_code: number[];
    };
}

export default function WeatherView({ onCityChange }: { onCityChange?: (cityName: string) => void }) {
    const { settings } = useTheme();
    const [selectedCity, setSelectedCity] = useState<City>(CITIES[0]);
    const [data, setData] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isCityMenuOpen, setIsCityMenuOpen] = useState(false);
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
        async function fetchWeather() {
            setLoading(true);
            try {
                const res = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${selectedCity.lat}&longitude=${selectedCity.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&current_weather=true&timezone=Asia%2FTokyo`
                );
                const json = await res.json();
                setData(json);
            } catch (error) {
                console.error("Failed to fetch weather:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchWeather();
    }, [selectedCity]);

    const selectCity = (city: City) => {
        setSelectedCity(city);
        localStorage.setItem("cnjp_weather_city", city.name);
        setIsCityMenuOpen(false);
    };

    const getWeatherIcon = (code: number, size: string = "w-6 h-6") => {
        if (code === 0) return <Sun className={`${size} text-orange-500`} />;
        if (code >= 1 && code <= 3) return <CloudSun className={`${size} text-yellow-500`} />;
        if (code >= 45 && code <= 48) return <Cloud className={`${size} text-gray-400`} />;
        if (code >= 51 && code <= 67) return <CloudRain className={`${size} text-blue-500`} />;
        if (code >= 71 && code <= 77) return <Snowflake className={`${size} text-cyan-400`} />;
        if (code >= 80 && code <= 82) return <CloudRain className={`${size} text-blue-600`} />;
        if (code >= 85 && code <= 86) return <Snowflake className={`${size} text-cyan-500`} />;
        if (code >= 95) return <CloudLightning className={`${size} text-purple-500`} />;
        return <Cloud className={`${size} text-gray-400`} />;
    };

    const getDayName = (dateStr: string) => {
        const date = new Date(dateStr);
        const day = date.getDay();
        const daysSC = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
        const daysTC = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
        return settings.lang === "sc" ? daysSC[day] : daysTC[day];
    };

    return (
        <div className="w-full">
            {/* Unified Weather Card - Static White/Gray Style */}
            <div className="luxury-card relative rounded-[32px] overflow-visible transition-all duration-300 z-20">

                {/* 1. Header: Location & Date */}
                <div className="p-8 pb-4 flex justify-between items-start">
                    {/* City Button Selector */}
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setIsCityMenuOpen(!isCityMenuOpen)}
                            className="flex items-center gap-2 text-2xl font-bold text-gray-800 dark:text-gray-100 hover:bg-black/5 dark:hover:bg-white/10 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                        >
                            <MapPin className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                            <span>{settings.lang === "sc" ? selectedCity.name : selectedCity.name_tc}</span>
                            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isCityMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <div className="text-[10px] pl-4 mt-1 text-gray-400 dark:text-gray-500 font-medium tracking-wider uppercase">
                            {settings.lang === "sc" ? "点击切换" : "點擊切換"}
                        </div>

                        {/* Custom City Popup */}
                        <AnimatePresence>
                            {isCityMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.1 }}
                                    className="absolute top-16 left-0 w-64 p-4 bg-white dark:bg-[#252525] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 z-50"
                                >
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">
                                        {settings.lang === "sc" ? "选择城市" : "選擇城市"}
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {CITIES.map(city => (
                                            <button
                                                key={city.name}
                                                onClick={() => selectCity(city)}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all border ${selectedCity.name === city.name
                                                    ? "bg-blue-500 text-white border-blue-500 shadow-md"
                                                    : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-white/10"
                                                    }`}
                                            >
                                                {settings.lang === "sc" ? city.name : city.name_tc}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Today's Date */}
                    <div className="text-right">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            {new Date().toLocaleDateString(settings.lang === 'sc' ? 'zh-CN' : 'zh-TW', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </div>
                    </div>
                </div>

                {/* 2. Current Weather Big View */}
                <div className="px-8 py-6 flex flex-col items-center justify-center">
                    {loading ? (
                        <div className="h-32 flex items-center justify-center">
                            <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
                        </div>
                    ) : data ? (
                        <div className="flex items-center gap-8">
                            <div className="drop-shadow-sm">
                                {getWeatherIcon(data.current_weather.weathercode, "w-32 h-32")}
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="text-8xl font-bold tracking-tighter text-gray-800 dark:text-white">
                                    {Math.round(data.current_weather.temperature)}°
                                </span>
                                <span className="text-lg font-medium text-gray-500 dark:text-gray-400 pl-2">
                                    {settings.lang === "sc" ? "当前气温" : "當前氣溫"}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-2xl text-gray-300">--</div>
                    )}
                </div>

                {/* 3. Divider */}


                {/* 4. 5-Day Forecast Row */}
                <div className="p-6 bg-gray-50/50 dark:bg-white/5 rounded-b-[32px]">
                    {loading ? (
                        <div className="text-center text-gray-400 text-sm">Loading forecast...</div>
                    ) : data ? (
                        <div className="grid grid-cols-5 divide-x divide-gray-200 dark:divide-white/10">
                            {data.daily.time.slice(0, 5).map((time, i) => (
                                <motion.div
                                    key={time}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="flex flex-col items-center gap-2 px-2"
                                >
                                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">
                                        {i === 0
                                            ? (settings.lang === "sc" ? "今天" : "今天")
                                            : getDayName(time)
                                        }
                                    </span>
                                    <div className="py-2 scale-110">
                                        {getWeatherIcon(data.daily.weather_code[i], "w-8 h-8")}
                                    </div>
                                    <div className="flex flex-col items-center text-sm font-bold text-gray-700 dark:text-gray-200">
                                        <span>{Math.round(data.daily.temperature_2m_max[i])}°</span>
                                        <span className="text-gray-400 text-xs">{Math.round(data.daily.temperature_2m_min[i])}°</span>
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
