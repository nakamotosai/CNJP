export default function Loading() {
    return (
        <div className="min-h-screen bg-[#f5f7fa] dark:bg-[#121212]">
            {/* Header Skeleton */}
            <div className="w-full bg-white dark:bg-[#121212] shadow-sm">
                <div className="max-w-[600px] mx-auto px-4 pt-3 pb-2">
                    {/* Top Row */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                            <div className="flex flex-col gap-1">
                                <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                                <div className="h-3 w-40 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                            <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                            <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                        </div>
                    </div>

                    {/* Search & Archive Bar */}
                    <div className="flex justify-between items-center gap-3">
                        <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                        <div className="w-20 h-8 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <main className="max-w-[600px] mx-auto pb-10">
                {/* Category Nav Skeleton */}
                <div className="sticky top-0 z-40 bg-[#f5f7fa] dark:bg-[#121212] pt-3 pb-2 px-4">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                            <div
                                key={i}
                                className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse flex-shrink-0"
                            />
                        ))}
                    </div>
                </div>

                {/* News Cards Skeleton */}
                <div className="px-4 space-y-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                            key={i}
                            className="bg-white dark:bg-[#1e1e1e] p-4 rounded-2xl shadow-card animate-pulse"
                        >
                            {/* Top row: category, source, time */}
                            <div className="flex items-center gap-2 mb-2">
                                <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                                <div className="h-3 w-1 bg-gray-200 dark:bg-gray-700 rounded" />
                                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                                <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                            </div>

                            {/* Title lines */}
                            <div className="space-y-2">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Loading indicator */}
            <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse z-[9999]" />
        </div>
    );
}
