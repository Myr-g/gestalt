import { useState, useEffect, useRef } from 'react';
import { convertFileSrc } from "@tauri-apps/api/core";
import { dirname, join } from "@tauri-apps/api/path";
import { mkdir, copyFile, remove } from "@tauri-apps/plugin-fs";

import './App.css';

function Practice({ libraryPath, session, setSession, setIsPracticing, shortcuts })
{
    const [timeRemaining, setTimeRemaining] = useState(session.timer);
    const [paused, setPaused] = useState(false);

    const [workspacePadding, setWorkspacePadding] = useState({x: 0, y: 0});

    const [zoom, setZoom] = useState(0.25);
    const [imageSize, setImageSize] = useState({width: 0, height: 0});

    const viewportRef = useRef(null);
    const fitZoom = viewportRef.current && imageSize.width > 0 ? Math.min(viewportRef.current.clientWidth / imageSize.width, viewportRef.current.clientHeight / imageSize.height) : 1;

    const MIN_ZOOM = 0.25;
    const MAX_ZOOM = 10;
    const ZOOM_STEP = 0.25; 

    const [dragging, setDragging] = useState(false);
    const dragStart = useRef({
        x: 0,
        y: 0,
        scrollLeft: 0,
        scrollTop: 0
    });

    const [rotation, setRotation] = useState(0);

    const [showSummary, setShowSummary] = useState(false);
    const [duration, setDuration] = useState(null);
    const [archiveSelection, setArchiveSelection] = useState([]);

    useEffect(() => {
        if(session.mode !== "Timed" || paused)
        {
            return;
        }

        const interval = setInterval(() => {
            setTimeRemaining(timeRemaining => Math.max(timeRemaining - 1, 0));
        }, 1000);

        return () => clearInterval(interval);
    }, [session.mode, paused]);

    useEffect(() => {
        if(session.mode != "Timed") 
        {
            return;
        }

        if(timeRemaining <= 0)
        {
            nextReference();
        }
    }, [timeRemaining, session.mode]);

    const fitImage = () => {
        if (!viewportRef.current || imageSize.width === 0) {
            return;
        }

        const viewport = viewportRef.current;

        const scaleX = viewport.clientWidth / imageSize.width;
        const scaleY = viewport.clientHeight / imageSize.height;

        setWorkspacePadding({x: viewport.clientWidth / 2, y: viewport.clientHeight / 2});
        setZoom(Math.min(scaleX, scaleY));

        requestAnimationFrame(() => {
            viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
            viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
        });
    };

    useEffect(() => {
        if(imageSize.width > 0)
        {
            fitImage();
            setRotation(0);
            setZoom(fitZoom);
        }
    }, [imageSize]);

    const handleWheel = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const viewport = viewportRef.current;
        const rect = viewport.getBoundingClientRect();

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setZoom(currentZoom => {
            const newZoom = e.deltaY < 0 ? Math.min(MAX_ZOOM, currentZoom + ZOOM_STEP) : Math.max(fitZoom, currentZoom - ZOOM_STEP);

            if(newZoom === currentZoom) 
            {
                return currentZoom;
            }

            if(newZoom === fitZoom)
            {
                requestAnimationFrame(() => {
                    viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
                    viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
                });

                return newZoom;
            }

            const ratio = newZoom / currentZoom;

            const imageX = viewport.scrollLeft + mouseX - workspacePadding.x;
            const imageY = viewport.scrollTop + mouseY - workspacePadding.y;

            const newImageX = imageX * ratio;
            const newImageY = imageY * ratio;

            const newScrollLeft =  workspacePadding.x + newImageX - mouseX;
            const newScrollTop = workspacePadding.y + newImageY - mouseY;

            requestAnimationFrame(() => {
                viewport.scrollLeft = newScrollLeft;
                viewport.scrollTop = newScrollTop;
            });

            return newZoom;
        });
    };

    useEffect(() => {
        const viewport = viewportRef.current;

        if(!viewport)
        {
            return;
        }

        viewport.addEventListener("wheel", handleWheel, {
            passive: false
        });

        return () => {
            viewport.removeEventListener("wheel", handleWheel);
        };
    }, [handleWheel]);

    const handleMouseDown = (e) => {
        if(e.button !== 0)
        {
            return;
        }

        e.preventDefault();

        setDragging(true);

        dragStart.current = {
            x: e.clientX,
            y: e.clientY,
            scrollLeft: viewportRef.current.scrollLeft,
            scrollTop: viewportRef.current.scrollTop
        };
    };

    const handleMouseMove = (e) => {
        if(!dragging)
        {
            return;
        }

        e.preventDefault();

        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;

        viewportRef.current.scrollLeft = dragStart.current.scrollLeft - dx;
        viewportRef.current.scrollTop = dragStart.current.scrollTop - dy;
    };

    const handleMouseUp = () => {
        setDragging(false);
    };

    const previousReference = () => {
        if(session.currentIndex === 0)
        {
            return;
        }

        const prevIndex = session.currentIndex - 1;
        const prevRef = session.references[prevIndex];

        setSession(session => ({...session, currentIndex: prevIndex, currentReference: prevRef}));

        if(session.mode === "Timed")
        {
            setTimeRemaining(session.timer);
        }

        setPaused(false);
    };

    const nextReference = () => {
        const nextIndex = session.currentIndex + 1;

        if(nextIndex >= session.references.length)
        {
            endPractice();
            return;
        }

        const nextRef = session.references[nextIndex];
        const shownReferences = session.shownReferences.some(ref => ref.path === nextRef.path) ? session.shownReferences : [...session.shownReferences, nextRef];
        
        setSession(session => ({...session, currentIndex: nextIndex, currentReference: nextRef, shownReferences: shownReferences}));

        if(session.mode === "Timed")
        {
            setTimeRemaining(session.timer);
        }

        setPaused(false);
    };

    const endPractice = () => {
        setPaused(true);
        getDuration();
        setShowSummary(true);
    };

    const getDuration = () => {
        if(showSummary)
        {
            return;
        }
        
        const miliseconds = Date.now() - session.startTime;
        const seconds = Math.floor(miliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        setDuration(`${minutes}m ${remainingSeconds}s`);
    };

    const getBaseName = (folderPath) => {
        return folderPath.split(/[/\\]/).pop();
    };

    const archiveReferences = async() => {
        const referencesDir = await join(libraryPath, "References");

        for(const refPath of archiveSelection)
        {
            try
            {
                const sep = refPath.includes("\\") ? "\\" : "/";
                const relativePath = refPath.replace(referencesDir + sep, "");

                const archivePath = await join(libraryPath, "Archive", relativePath);
                const archiveDir = await dirname(archivePath);

                await mkdir(archiveDir, { recursive: true });

                await copyFile(refPath, archivePath);

                await remove(refPath);
            }

            catch(error)
            {
                console.error(`Failed to archive ${refPath}: `, error);
            }
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if(!showSummary)
            {
                if(e.key === shortcuts.rotateClockwise)
                {
                    e.preventDefault();
                    setRotation(rotation => (rotation + 10) % 360);
                }

                if(e.key === shortcuts.rotateCounterClockwise)
                {
                    e.preventDefault();
                    setRotation(rotation => (rotation - 10) % 360);
                }
                if(e.key === shortcuts.previousReference)
                {
                    e.preventDefault();
                    previousReference();
                }

                if(e.key === shortcuts.nextReference)
                {
                    e.preventDefault();
                    nextReference();
                }

                if(e.key === shortcuts.pauseTimer)
                {
                    e.preventDefault();
                    setPaused(paused => !paused);
                }

                if(e.key === shortcuts.endSession)
                {
                    e.preventDefault();
                    endPractice();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [previousReference, nextReference, endPractice]);

    return(
        <>
            <div className="practice">
                {session.mode === "Timed" && (
                    <span className='reference-timer'>{timeRemaining}</span>
                )}

                <div className={`reference-viewport ${dragging ? "dragging" : ""}`} ref={viewportRef} onPointerDown={handleMouseDown} onPointerMove={handleMouseMove} onPointerUp={handleMouseUp} onPointerLeave={handleMouseUp}>
                    <div className='reference-canvas-container' style={{padding: `${workspacePadding.y}px ${workspacePadding.x}px`}}>
                        <div className='reference-canvas' style={{width: `${imageSize.width * zoom}px`, height: `${imageSize.height * zoom}px`}}>
                            <img src={convertFileSrc(session.currentReference.path)} alt={session.currentReference.name} onLoad={(e) => setImageSize(imageSize => ({...imageSize, width: e.target.naturalWidth, height: e.target.naturalHeight}))} style={{transform: `rotate(${rotation}deg)`}}/>
                        </div>
                    </div>
                </div>

                <div className="reference-actions">
                    <button onClick={() => setRotation(rotation => (rotation - 10) % 360)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 16 16">
	                        <path d="M0 0h16v16H0z" fill="none" />
	                        <path fill="currentColor" fillRule="evenodd" d="M8 1.5a6.5 6.5 0 1 1-6.445 7.348a.75.75 0 1 1 1.487-.194A5.001 5.001 0 1 0 4.43 4.5h1.32a.75.75 0 0 1 0 1.5h-3A.75.75 0 0 1 2 5.25v-3a.75.75 0 0 1 1.5 0v1.06A6.48 6.48 0 0 1 8 1.5" clipRule="evenodd" />
                        </svg>
                    </button>

                    <button onClick={() => setRotation(rotation => (rotation + 10) % 360)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 16 16">
	                        <path d="M0 0h16v16H0z" fill="none" />
	                        <path fill="currentColor" fillRule="evenodd" d="M8 1.5a6.5 6.5 0 1 0 6.445 7.348a.75.75 0 1 0-1.487-.194A5.001 5.001 0 1 1 11.57 4.5h-1.32a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 .75-.75v-3a.75.75 0 0 0-1.5 0v1.06A6.48 6.48 0 0 0 8 1.5" clipRule="evenodd" />
                        </svg>
                    </button>

                    <button onClick={() => previousReference()}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                            <path d="M0 0h24v24H0z" fill="none" />
	                        <path fill="currentColor" d="m4.431 12.822l13 9A1 1 0 0 0 19 21V3a1 1 0 0 0-1.569-.823l-13 9a1.003 1.003 0 0 0 0 1.645" />
                        </svg>
                    </button>

                    {session.mode === "Timed" && (
                        <button onClick={() => setPaused(paused => !paused)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 16 16">
	                            <path d="M0 0h16v16H0z" fill="none" />
	                            <path fill="currentColor" d="M1 4.804a1 1 0 0 1 1.53-.848l5.113 3.196a1 1 0 0 1 0 1.696L2.53 12.044A1 1 0 0 1 1 11.196zM13.5 4.5A.5.5 0 0 1 14 4h.5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5H14a.5.5 0 0 1-.5-.5zm-3-.5a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h.5a.5.5 0 0 0 .5-.5v-7A.5.5 0 0 0 11 4z" />
                            </svg>
                        </button>
                    )}

                    <button onClick={() => nextReference()}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
	                        <path d="M0 0h24v24H0z" fill="none" />
	                        <path fill="currentColor" d="M5.536 21.886a1 1 0 0 0 1.033-.064l13-9a1 1 0 0 0 0-1.644l-13-9A1 1 0 0 0 5 3v18a1 1 0 0 0 .536.886" />
                        </svg>
                    </button>

                    <button className='end-button' onClick={() => endPractice()}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512">
	                        <path d="M0 0h512v512H0z" fill="none" />
	                        <path fill="currentColor" d="M392 432H120a40 40 0 0 1-40-40V120a40 40 0 0 1 40-40h272a40 40 0 0 1 40 40v272a40 40 0 0 1-40 40" />
                        </svg>
                    </button>
                </div>
            </div>

            {showSummary && (
                <div className='summary-overlay'>
                    <div className='summary'>
                        <h2>Session Summary</h2>

                        <div className='summary-info'>
                            <label>Duration</label>
                            <p>{duration}</p>

                            <label>References Shown</label>
                            <span>{session.shownReferences.length}</span>

                            <label>Selected Folders</label>
                            <div className='summary-folders'>
                                {session.selectedFolders.map(getBaseName).join(", ")}
                            </div>
                        </div>

                        <div className='summary-archive'>
                            <div className='archive-actions'>
                                <button onClick={() => setArchiveSelection(session.shownReferences.map(ref => ref.path))}>Select All</button>
                                <button onClick={() => setArchiveSelection([])}>Select None</button>
                            </div>

                            <div className='shown-references'>
                                {session.shownReferences.map(image => (
                                    <img key={image.path} src={convertFileSrc(image.path)} alt={image.name} className={archiveSelection.includes(image.path) ? 'selected' : ''} onClick={() => {
                                            setArchiveSelection(archiveSelection => archiveSelection.includes(image.path) ? archiveSelection.filter(p => p !== image.path) : [...archiveSelection, image.path]);
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className='summary-actions'>
                            {archiveSelection.length <= 0 && (
                                <button onClick={() => setIsPracticing(false)}>Finish</button>
                            )}
                            
                            {archiveSelection.length > 0 && (
                                <button onClick={async() => { await archiveReferences(); setIsPracticing(false); }}>Archive & Finish</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default Practice;