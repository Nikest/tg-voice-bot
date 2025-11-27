export const dynamic = 'force-dynamic';

import dbConnect from "@/lib/mongoose";
import NoiseSettings from "@/models/NoiseSettings";

export default async function NoisesPage() {
    await dbConnect();


    let noises = await NoiseSettings.find().sort({ createdAt: -1 }).lean();

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

                        <div className="text-sm">
                            <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Tags (comma separated)
                            </label>
                            <input
                                name="tags"
                                type="text"
                                placeholder="e.g. rain, street, night, lo-fi"
                                className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-2 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400"
                            />
                            <p className="text-[10px] text-zinc-500 mt-1">
                                Used to find noise later. Example: "office, typing"
                            </p>
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
                                <div
                                    key={n._id}
                                    className="rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                                    System Name
                                                </div>
                                                <div className="font-mono text-sm text-zinc-800 dark:text-zinc-200 break-all">
                                                    {n.name}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mb-3">
                                            <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
                                                Tags
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {n.tags && n.tags.length > 0 ? (
                                                    n.tags.map((tag, idx) => (
                                                        <span key={idx} className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                                                            #{tag}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-zinc-400 italic">No tags</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                                        <audio
                                            controls
                                            className="w-full h-8"
                                            src={`/voices/${n.fileName}`}
                                        />
                                        <div className="text-[10px] text-zinc-400 mt-1 text-right truncate">
                                            File: {n.fileName}
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