import React, { useState, useRef, useEffect } from 'react';
import { IconMaximize, IconMinimize, IconVolumeOff } from '@tabler/icons-react';

interface CustomVideoPlayerProps {
    videoId: string;
}

declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

export interface VideoPlayerRef {
    getCurrentTime: () => number;
    getDuration: () => number;
    seekTo: (seconds: number) => void;
    getPlayerState: () => number;
    isLive: () => boolean;
}

const CustomVideoPlayer = React.forwardRef<VideoPlayerRef, CustomVideoPlayerProps>(({ videoId }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);

    // Expose methods to parent
    React.useImperativeHandle(ref, () => ({
        getCurrentTime: () => playerRef.current && typeof playerRef.current.getCurrentTime === 'function' ? playerRef.current.getCurrentTime() : 0,
        getDuration: () => playerRef.current && typeof playerRef.current.getDuration === 'function' ? playerRef.current.getDuration() : 0,
        seekTo: (seconds: number) => {
            if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
                playerRef.current.seekTo(seconds, true);
            }
        },
        getPlayerState: () => playerRef.current && typeof playerRef.current.getPlayerState === 'function' ? playerRef.current.getPlayerState() : -1,
        isLive: () => {
            if (playerRef.current && typeof playerRef.current.getVideoData === 'function') {
                return playerRef.current.getVideoData().isLive;
            }
            return false;
        }
    }));

    // Extract ID if full URL is provided
    const getYoutubeId = (urlOrId: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/)([^#&?]*).*/;
        const match = urlOrId.match(regExp);
        return (match && match[2].length === 11) ? match[2] : urlOrId;
    };

    const finalVideoId = getYoutubeId(videoId);

    useEffect(() => {
        let isMounted = true;

        const initPlayer = () => {
            if (!finalVideoId) {
                setHasError(true);
                if (playerRef.current) {
                    playerRef.current.destroy();
                    playerRef.current = null;
                }
                return;
            }
            setHasError(false);

            if (window.YT && window.YT.Player) {
                createPlayer();
            } else {
                // Load API
                const tag = document.createElement('script');
                tag.src = "https://www.youtube.com/iframe_api";
                const firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

                window.onYouTubeIframeAPIReady = () => {
                    if (isMounted) createPlayer();
                };
            }
        };

        const createPlayer = () => {
            if (playerRef.current) {
                playerRef.current.destroy();
            }

            playerRef.current = new window.YT.Player('youtube-player', {
                height: '100%',
                width: '100%',
                videoId: finalVideoId,
                playerVars: {
                    autoplay: 1,
                    mute: 1, // Start muted to ensure autoplay works (browser policy)
                    controls: 0,
                    rel: 0,
                    modestbranding: 1,
                    playsinline: 1,
                    iv_load_policy: 3,
                    showinfo: 0,
                    enablejsapi: 1,
                    origin: window.location.origin
                },
                events: {
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange,
                    'onError': onPlayerError
                }
            });
        };

        const onPlayerReady = (event: any) => {
            // Check if user has already interacted (e.g. quick click) ?? 
            // Actually, we must start muted. 
            // If hasInteracted is true (maybe re-render?), we can try to unmute.
            // But relying on click is safest.
            event.target.playVideo();
        };

        const onPlayerStateChange = (_event: any) => {
            // Optional state handling
        };

        const onPlayerError = (event: any) => {
            console.warn('YouTube Player Error:', event.data);
            if (isMounted) setHasError(true);
        };

        initPlayer();

        return () => {
            isMounted = false;
            if (playerRef.current && playerRef.current.destroy) {
                // playerRef.current.destroy(); 
            }
        };
    }, [finalVideoId]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full bg-black group overflow-hidden"
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
        >
            {/* Player Container */}
            <div id="youtube-player" className="w-full h-full pointer-events-none"></div>

            {/* Interaction Overlay (Start Meeting) */}
            {!hasInteracted && !hasError && (
                <div
                    className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center cursor-pointer transition-opacity duration-300"
                    onClick={() => {
                        setHasInteracted(true);
                        if (playerRef.current) {
                            if (typeof playerRef.current.unMute === 'function') playerRef.current.unMute();
                            if (typeof playerRef.current.playVideo === 'function') playerRef.current.playVideo();
                        }
                    }}
                >
                    <div className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-full font-bold text-lg shadow-[0_0_30px_rgba(79,70,229,0.5)] transform hover:scale-105 transition-all flex items-center gap-3 animate-pulse">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Start Meeting
                    </div>
                    <p className="text-gray-400 mt-4 text-sm font-medium">Click to join audio and video</p>
                </div>
            )}

            {/* Transparent Interaction Shield (only when playing) */}
            {hasInteracted && (
                <div
                    className="absolute inset-0 z-10 w-full h-full"
                    // Keep global click to ensure unmute/play just in case
                    onClick={() => {
                        if (playerRef.current) {
                            if (typeof playerRef.current.unMute === 'function') playerRef.current.unMute();
                            if (typeof playerRef.current.playVideo === 'function') playerRef.current.playVideo();
                        }
                    }}
                ></div>
            )}

            {/* Error / Offline Overlay */}
            {hasError && (
                <div className="absolute inset-0 z-15 bg-gray-900 flex flex-col items-center justify-center text-center p-6">
                    <IconVolumeOff size={48} className="text-gray-600 mb-4" />
                    <h3 className="text-xl font-bold text-gray-300 mb-2">Waiting for Broadcast</h3>
                    <p className="text-gray-500 max-w-md">The live stream is currently unavailable or has ended. Please wait for the host to resume.</p>
                </div>
            )}

            {/* Custom Overlay Controls - Simple Fullscreen */}
            <div className={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 transition-all duration-300 transform ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                <div className="flex items-center justify-between text-white">
                    {/* Empty left side to push fullscreen to right */}
                    <div></div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                            className="hover:text-indigo-400 transition hover:bg-white/10 p-2 rounded-full"
                        >
                            {isFullscreen ? <IconMinimize size={24} /> : <IconMaximize size={24} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default CustomVideoPlayer;
