'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NoiseItem({ noise }) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [volume, setVolume] = useState(noise.volume || '1.35');
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/noises', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: noise._id, volume }),
            });

            if (res.ok) {
                setIsEditing(false);
                router.refresh();
            } else {
                alert('Failed to update volume');
            }
        } catch (error) {
            alert('Error updating volume');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm flex flex-col justify-between h-full">
            <div>
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            System Name
                        </div>
                        <div className="font-mono text-sm text-zinc-800 dark:text-zinc-200 break-all">
                            {noise.name}
                        </div>
                    </div>
                </div>

                <div className="mb-3">
                    <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
                        Tags
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {noise.tags && noise.tags.length > 0 ? (
                            noise.tags.map((tag, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                                    #{tag}
                                </span>
                            ))
                        ) : (
                            <span className="text-xs text-zinc-400 italic">No tags</span>
                        )}
                    </div>
                </div>

                {/* Volume Edit Section */}
                <div className="mb-3">
                    <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
                        Volume
                    </div>
                    {isEditing ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={volume}
                                onChange={(e) => setVolume(e.target.value)}
                                className="w-20 rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-50"
                            />
                            <button
                                onClick={handleSave}
                                disabled={isLoading}
                                className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                            >
                                {isLoading ? '...' : 'Save'}
                            </button>
                            <button
                                onClick={() => {
                                    setIsEditing(false);
                                    setVolume(noise.volume || '1.35');
                                }}
                                className="text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 px-2 py-1 rounded hover:opacity-80"
                            >
                                X
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-zinc-800 dark:text-zinc-200">
                                {volume}
                            </span>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                Edit
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <audio
                    controls
                    className="w-full h-8"
                    src={`/voices/${noise.fileName}`}
                />
                <div className="text-[10px] text-zinc-400 mt-1 text-right truncate">
                    File: {noise.fileName}
                </div>
            </div>
        </div>
    );
}