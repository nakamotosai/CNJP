"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string; // Kept for interface compatibility but not used in new layout
    children: React.ReactNode;
    size?: "default" | "wide"; // 新增宽度选项
}

export default function Modal({ isOpen, onClose, title, children, size = "default" }: ModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!mounted) return null;
    if (!isOpen) return null;

    // 根据 size 确定最大宽度
    const maxWidthClass = size === "wide"
        ? "max-w-[90vw] md:max-w-[800px] lg:max-w-[900px]"
        : "max-w-[360px]";

    return createPortal(
        <div
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-[4px] animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div
                className={`relative w-full ${maxWidthClass} max-h-[80dvh] flex flex-col animate-in zoom-in-95 fade-in duration-300`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button - Outside Top Right */}
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md cursor-pointer"
                    aria-label="Close"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Content Card - No Header Bar */}
                <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-white/20 modal-content w-full flex-1 min-h-0 rounded-2xl shadow-elevated overflow-hidden flex flex-col text-[var(--text-main)]">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
