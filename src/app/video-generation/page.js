'use client';

import { useState, useEffect } from 'react';

export default function VideoGenerationPage() {
    const [voices, setVoices] = useState([]);
    const [selectedVoice, setSelectedVoice] = useState('');
    const [text, setText] = useState('');
    const [photo, setPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [videoId, setVideoId] = useState(null);
    const [videoStatus, setVideoStatus] = useState(null);
    const [videoUrl, setVideoUrl] = useState(null);
    const [error, setError] = useState(null);

    // Load voices on mount
    useEffect(() => {
        async function loadVoices() {
            try {
                const res = await fetch('/api/heygen?action=voices');
                const data = await res.json();
                if (data.voices) {
                    setVoices(data.voices);
                    if (data.voices.length > 0) {
                        setSelectedVoice(data.voices[0].voice_id);
                    }
                }
            } catch (err) {
                console.error('Failed to load voices:', err);
            }
        }
        loadVoices();
    }, []);

    // Poll video status when videoId is set
    useEffect(() => {
        if (!videoId) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/heygen?video_id=${videoId}`);
                const data = await res.json();

                setVideoStatus(data.status);

                if (data.status === 'completed') {
                    setVideoUrl(data.local_url);
                    setLoading(false);
                    clearInterval(interval);
                } else if (data.status === 'failed') {
                    setError(data.error || 'Video generation failed');
                    setLoading(false);
                    clearInterval(interval);
                }
            } catch (err) {
                console.error('Failed to check status:', err);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [videoId]);

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPhoto(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setVideoId(null);
        setVideoStatus(null);
        setVideoUrl(null);

        if (!photo || !text || !selectedVoice) {
            setError('Please fill in all fields');
            return;
        }

        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('photo', photo);
            formData.append('text', text);
            formData.append('voiceId', selectedVoice);

            const res = await fetch('/api/heygen', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (data.error) {
                setError(data.error);
                setLoading(false);
                return;
            }

            setVideoId(data.video_id);
            setVideoStatus('pending');
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const resetForm = () => {
        setPhoto(null);
        setPhotoPreview(null);
        setText('');
        setVideoId(null);
        setVideoStatus(null);
        setVideoUrl(null);
        setError(null);
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-6">
            <div className="w-full max-w-2xl space-y-6">
                <div className="rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-sm">
                    <h1 className="text-2xl font-bold mb-6 text-black dark:text-white text-center">
                        HeyGen Video Generation
                    </h1>

                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    {!videoUrl ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Photo Upload */}
                            <div>
                                <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    Photo
                                </label>
                                <div className="mt-2">
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/jpg"
                                        onChange={handlePhotoChange}
                                        className="w-full text-sm text-zinc-900 dark:text-zinc-50
                                            file:mr-3 file:rounded-md file:border-0
                                            file:bg-zinc-200 dark:file:bg-zinc-700
                                            file:px-3 file:py-1.5 file:text-sm file:font-medium
                                            file:text-zinc-900 dark:file:text-zinc-50
                                            hover:file:bg-zinc-300 dark:hover:file:bg-zinc-600"
                                    />
                                </div>
                                {photoPreview && (
                                    <div className="mt-3">
                                        <img
                                            src={photoPreview}
                                            alt="Preview"
                                            className="max-w-xs rounded-lg border border-zinc-300 dark:border-zinc-700"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Voice Selection */}
                            <div>
                                <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    Voice
                                </label>
                                <select
                                    value={selectedVoice}
                                    onChange={(e) => setSelectedVoice(e.target.value)}
                                    className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50"
                                >
                                    {voices.length === 0 ? (
                                        <option value="">Loading voices...</option>
                                    ) : (
                                        voices.map((voice) => (
                                            <option key={voice.voice_id} value={voice.voice_id}>
                                                {voice.name} ({voice.language})
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>

                            {/* Text Input */}
                            <div>
                                <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    Text (Script)
                                </label>
                                <textarea
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder="Enter the text that the avatar will speak..."
                                    rows={5}
                                    maxLength={5000}
                                    className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 resize-none"
                                />
                                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 text-right">
                                    {text.length} / 5000
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={loading || !photo || !text || !selectedVoice}
                                    className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-6 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Processing...' : 'Generate Video'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        /* Video Result */
                        <div className="space-y-4">
                            <div className="text-center">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm">
                                    Video Ready
                                </div>
                            </div>

                            <video
                                src={videoUrl}
                                controls
                                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700"
                            />

                            <div className="flex justify-center gap-3">
                                <a
                                    href={videoUrl}
                                    download
                                    className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-6 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                                >
                                    Download Video
                                </a>
                                <button
                                    onClick={resetForm}
                                    className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-6 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                                >
                                    Create New
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Status Indicator */}
                    {loading && videoStatus && (
                        <div className="mt-4 text-center">
                            <div className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        fill="none"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                <span>
                                    Status: {videoStatus === 'pending' ? 'Waiting in queue...' :
                                            videoStatus === 'processing' ? 'Generating video...' :
                                            videoStatus}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Back Link */}
                <div className="text-center">
                    <a
                        href="/"
                        className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition"
                    >
                        Back to Dashboard
                    </a>
                </div>
            </div>
        </div>
    );
}
