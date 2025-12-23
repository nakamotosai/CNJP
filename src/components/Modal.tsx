"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string; // Kept for interface compatibility but not used in new layout
    children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
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
                className="relative w-full max-w-[360px] max-h-[80vh] animate-in zoom-in-95 fade-in duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button - Outside Top Right */}
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
                    aria-label="Close"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Content Card - No Header Bar */}
                <div className="bg-white dark:bg-[#1e1e1e] modal-content w-full rounded-2xl shadow-elevated overflow-hidden flex flex-col">
                    <div className="p-5 overflow-y-auto custom-scrollbar text-[var(--text-main)]">
                        {children}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
