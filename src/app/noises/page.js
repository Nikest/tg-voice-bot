export const dynamic = 'force-dynamic';

import dbConnect from "@/lib/mongoose";
import NoiseSettings from "@/models/NoiseSettings";
import NoiseItem from "@/components/NoiseItem";

export default async function NoisesPage() {
    await dbConnect();


    const noisesRaw = await NoiseSettings.find().sort({ createdAt: -1 }).lean();

    const noises = JSON.parse(JSON.stringify(noisesRaw));

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-6">
            <div className="w-full max-w-4xl space-y-6">

                <div className="rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
                    <h2 className="text-lg font-semibold mb-3 text-black dark:text-white text-center">
                        Upload Background Noise
                    </h2>

                    <form className="grid grid-cols-1 gap-4"
                          action="/api/noises"
                          method="POST"
                          encType="multipart/form-data"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="text-sm">
                                <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    Tags (comma separated)
                                </label>
                                <input
                                    name="tags"
                                    type="text"
                                    placeholder="e.g. rain, street"
                                    className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-2 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400"
                                />
                            </div>

                            <div className="text-sm">
                                <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    Default Volume
                                </label>
                                <input
                                    name="volume"
                                    type="text"
                                    defaultValue="1.35"
                                    placeholder="1.35"
                                    className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-2 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400"
                                />
                                <p className="text-[10px] text-zinc-500 mt-1">
                                    Ffmpeg volume factor (e.g. 0.5 is half, 2.0 is double)
                                </p>
                            </div>
                        </div>

                        <div className="text-sm">
                            <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Noise File (MP3/WAV)
                            </label>
                            <input
                                name="noiseFile"
                                type="file"
                                accept="audio/*"
                                required
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
                                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-900 dark:bg-zinc-100 px-6 py-2 text-sm font-medium text-white dark:text-black hover:opacity-90 transition"
                            >
                                Upload Noise
                            </button>
                        </div>
                    </form>
                </div>

                <br/>

                <div className="w-full max-w-4xl">
                    <h1 className="text-center text-2xl font-bold mb-6 text-black dark:text-white">
                        Library
                    </h1>

                    {noises.length === 0 ? (
                        <div className="text-center text-zinc-500 dark:text-zinc-400">
                            No background noises found.
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {noises.map((n) => (
                                <NoiseItem key={n._id} noise={n} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}