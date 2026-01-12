import React, { useState, useRef, useEffect } from 'react';
import { IconMaximize, IconMinimize, IconVolume, IconVolumeOff } from '@tabler/icons-react';

interface CustomVideoPlayerProps {
    videoId: string;
}

declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = ({ videoId }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const [isMuted, setIsMuted] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(false);
    // const [playerStatus, setPlayerStatus] = useState<number>(-1); // -1: Unstarted
    const [hasError, setHasError] = useState(false);

    // Extract ID if full URL is provided
    const getYoutubeId = (urlOrId: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
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
                    mute: 1,
                    controls: 0,
                    rel: 0,
                    modestbranding: 1,
                    playsinline: 1,
                    iv_load_policy: 3,
                    showinfo: 0,
                    enablejsapi: 1
                },
                events: {
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange,
                    'onError': onPlayerError
                }
            });
        };

        const onPlayerReady = (event: any) => {
            event.target.playVideo();
        };

        const onPlayerStateChange = (_event: any) => {
            // if (isMounted) setPlayerStatus(event.data);
        };

        const onPlayerError = (event: any) => {
            console.warn('YouTube Player Error:', event.data);
            if (isMounted) setHasError(true);
        };

        initPlayer();

        return () => {
            isMounted = false;
            // Don't destroy immediately on unmount to prevent flash if re-rendering, 
            // but here we want to cleanup if ID changes.
            if (playerRef.current && playerRef.current.destroy) {
                // playerRef.current.destroy(); // Optional, sometimes causes issues with React HMR
            }
        };
    }, [finalVideoId]);

    const toggleMute = () => {
        if (playerRef.current && playerRef.current.isMuted) {
            if (playerRef.current.isMuted()) {
                playerRef.current.unMute();
                setIsMuted(false);
            } else {
                playerRef.current.mute();
                setIsMuted(true);
            }
        }
    };

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

            {/* Transparent Interaction Shield */}
            <div className="absolute inset-0 z-10 w-full h-full"></div>

            {/* Error / Offline Overlay */}
            {hasError && (
                <div className="absolute inset-0 z-15 bg-gray-900 flex flex-col items-center justify-center text-center p-6">
                    <IconVolumeOff size={48} className="text-gray-600 mb-4" />
                    <h3 className="text-xl font-bold text-gray-300 mb-2">Waiting for Broadcast</h3>
                    <p className="text-gray-500 max-w-md">The live stream is currently unavailable or has ended. Please wait for the host to resume.</p>
                </div>
            )}

            {/* Custom Overlay Controls */}
            <div className={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 transition-all duration-300 transform ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                            className="hover:text-indigo-400 transition hover:bg-white/10 p-2 rounded-full"
                        >
                            {isMuted ? <IconVolumeOff size={24} /> : <IconVolume size={24} />}
                        </button>
                    </div>

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
};

export default CustomVideoPlayer;
