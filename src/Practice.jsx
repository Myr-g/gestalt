import { useState, useEffect } from 'react';
import { convertFileSrc } from "@tauri-apps/api/core";
import { dirname, join } from "@tauri-apps/api/path";
import { mkdir, copyFile, remove } from "@tauri-apps/plugin-fs";

import './App.css';

function Practice({ libraryPath, session, setSession, setIsPracticing })
{
    const [timeRemaining, setTimeRemaining] = useState(session.timer);
    const [showSummary, setShowSummary] = useState(false);
    const [archiveSelection, setArchiveSelection] = useState([]);
    const [duration, setDuration] = useState(null);

    useEffect(() => {
        if(session.mode !== "Timed")
        {
            return;
        }

        const interval = setInterval(() => {
            setTimeRemaining(timeRemaining => Math.max(timeRemaining - 1, 0));
        }, 1000);

        return () => clearInterval(interval);
    }, [session.mode]);

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
    };

    const endPractice = () => {
        getDuration();
        setShowSummary(true);
    };

    const getDuration = () => {
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
                if(e.key === "ArrowLeft")
                {
                    previousReference();
                }

                if(e.key === "ArrowRight")
                {
                    nextReference();
                }

                if(e.key === "Escape")
                {
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

                <div className="reference-image">
                    <img src={convertFileSrc(session.currentReference.path)} alt={session.currentReference.name}/>
                </div>

                <div className="reference-actions">
                    <button onClick={() => previousReference()}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                            <path d="M0 0h24v24H0z" fill="none" />
	                        <path fill="currentColor" d="m4.431 12.822l13 9A1 1 0 0 0 19 21V3a1 1 0 0 0-1.569-.823l-13 9a1.003 1.003 0 0 0 0 1.645" />
                        </svg>
                    </button>
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