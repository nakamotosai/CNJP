"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
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
            className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center backdrop-blur-[4px] animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-[#1e1e1e] w-[85%] max-w-[360px] max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-4 py-3 border-b border-[#eee] dark:border-[#333] flex justify-between items-center">
                    <div className="font-bold text-base text-[var(--text-main)]">{title}</div>
                    <button
                        onClick={onClose}
                        className="bg-transparent border-none text-[#999] cursor-pointer p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto text-[var(--text-main)]">{children}</div>
            </div>
        </div>,
        document.body
    );
}
