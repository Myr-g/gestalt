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
        setShowSummary(true);
    };

    const getDuration = () => {
        const miliseconds = Date.now() - session.startTime;
        const seconds = Math.floor(miliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        return `${minutes}m ${remainingSeconds}s`;
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

    return(
        <>
            <div className="practice">
                {session.mode === "Timed" && (
                    <span>{timeRemaining}</span>
                )}

                <div className="preview-image">
                    <img src={convertFileSrc(session.currentReference.path)} alt={session.currentReference.name}/>
                </div>

                <div className="reference-actions">
                    <button onClick={() => previousReference()}>Prev</button>
                    <button onClick={() => nextReference()}>Next</button>
                    <button onClick={() => endPractice()}>End Practice</button>
                </div>
            </div>

            {showSummary && (
                <div className='summary-overlay'>
                    <div className='summary'>
                        <h2>Session Summary</h2>

                        <label>Duration</label>
                        <p>{getDuration()}</p>

                        <label>References Shown</label>
                        <span>{session.shownReferences.length}</span>

                        <label>Selected Folders</label>
                        <div className='summary-folders'>
                            {session.selectedFolders.map(folder => (
                                <p key={folder}>{folder}</p>
                            ))}
                        </div>

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