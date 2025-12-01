"use client";

export default function NewsCardSkeleton() {
    return (
        <div className="w-full bg-white dark:bg-[#1e1e1e] p-4 rounded-xl shadow-card border border-transparent animate-pulse">
            {/* Top Row Skeleton */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {/* Category dot */}
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700" />

                    {/* Date and source */}
                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-3 w-1 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-3 w-1 bg-gray-200 dark:bg-gray-700 rounded opacity-60" />
                    <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>

                {/* Star icon placeholder */}
                <div className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700" />
            </div>

            {/* Title Skeleton */}
            <div className="space-y-2">
                <div className="h-5 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-5 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
        </div>
    );
}
