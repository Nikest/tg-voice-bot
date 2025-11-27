export const dynamic = 'force-dynamic';

import dbConnect from "@/lib/mongoose";
import VoiceSettings from "@/models/VoiceSettings";

export default async function VoicesPage() {
    await dbConnect();

    let voices = await VoiceSettings.find().lean();

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-6">
            <div className="w-full max-w-4xl space-y-6">
            <div className="rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
                <h2 className="text-lg font-semibold mb-3 text-black dark:text-white text-center">
                    Add New Voice
                </h2>

                <form className="grid grid-cols-1 gap-3"
                      action="/api/voices"
                      method="POST"
                      encType="multipart/form-data"
                >

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="text-sm">
                            <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Voice ID
                            </label>
                            <input
                                name="voiceId"
                                type="text"
                                placeholder="ElevenLabs Voice ID"
                                className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-50"
                            />
                        </div>

                        <div className="text-sm">
                            <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Name
                            </label>
                            <input
                                name="voiceName"
                                type="text"
                                placeholder="Voice Name"
                                className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-50"
                            />
                        </div>
                    </div>


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="text-sm">
                            <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Stability
                            </label>
                            <input
                                name="stability"
                                type="number"
                                step="0.01"
                                defaultValue={0.5}
                                className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-50"
                            />
                        </div>

                        <div className="text-sm">
                            <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Similarity
                            </label>
                            <input
                                name="similarityBoost"
                                type="number"
                                step="0.01"
                                defaultValue={0.9}
                                className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-50"
                            />
                        </div>
                    </div>


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="text-sm">
                            <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Style
                            </label>
                            <input
                                name="style"
                                type="number"
                                step="0.01"
                                defaultValue={0.0}
                                className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-50"
                            />
                        </div>

                        <div className="flex items-end md:items-center gap-2 text-sm">
                            <div>
                                <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    Speaker Boost
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        name="useSpeakerBoost"
                                        type="checkbox"
                                        defaultChecked
                                        className="h-4 w-4"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                        <div className="text-sm">
                            <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Voice Example
                            </label>
                            <input
                                name="voiceExample"
                                type="file"
                                accept="audio/*"
                                className="mt-1 w-full text-sm text-zinc-900 dark:text-zinc-50
                             file:mr-3 file:rounded-md file:border-0
                             file:bg-zinc-200 dark:file:bg-zinc-700
                             file:px-3 file:py-1.5 file:text-sm file:font-medium
                             file:text-zinc-900 dark:file:text-zinc-50
                             hover:file:bg-zinc-300 dark:hover:file:bg-zinc-600"
                            />
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            <br/>

            <div className="w-full max-w-4xl">
                <h1 className="text-center text-2xl font-bold mb-6 text-black dark:text-white">
                    All Voices Settings
                </h1>

                {voices.length === 0 ? (
                    <div className="text-center text-zinc-500 dark:text-zinc-400">
                        No voices found.
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {voices.map((v) => (
                            <div
                                key={v._id}
                                className="rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm"
                            >
                                <div className="grid grid-cols-1 gap-3">
                                    {/* Row 1: Voice ID | Name */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="text-sm">
                                            <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                                Voice ID
                                            </div>
                                            <div className="mt-1 text-[11px] break-all text-zinc-800 dark:text-zinc-100">
                                                {v.voiceId}
                                            </div>
                                        </div>

                                        <div className="text-sm">
                                            <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                                Name
                                            </div>
                                            <div className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                                                {v.voiceName}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2: Stability | Similarity */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="text-sm">
                                            <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                                Stability
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                defaultValue={v.stability}
                                                className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-50"
                                            />
                                        </div>

                                        <div className="text-sm">
                                            <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                                Similarity
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                defaultValue={v.similarityBoost}
                                                className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-50"
                                            />
                                        </div>
                                    </div>

                                    {/* Row 3: Style | Speaker Boost */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="text-sm">
                                            <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                                Style
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                defaultValue={v.style}
                                                className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-50"
                                            />
                                        </div>

                                        <div className="flex items-end justify-between md:justify-start gap-2 text-sm">
                                            <div>
                                                <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                                    Speaker Boost
                                                </div>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        defaultChecked={v.useSpeakerBoost}
                                                        className="h-4 w-4"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 4: Button Update */}
                                    <div className="mt-2 flex justify-end">
                                        <button
                                            type="button"
                                            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-4 py-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                                            disabled
                                        >
                                            Update (TODO)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            </div>
        </div>
    );
}
