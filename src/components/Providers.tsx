"use client";

import { ThemeProvider } from "./ThemeContext";
import { AiAnalysisProvider } from "./AiAnalysisContext";
import ErrorBoundary from "./ErrorBoundary";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <AiAnalysisProvider>
                <ErrorBoundary>
                    {children}
                </ErrorBoundary>
            </AiAnalysisProvider>
        </ThemeProvider>
    );
}
