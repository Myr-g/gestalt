import { useState } from 'react'
import { join } from '@tauri-apps/api/path';
import { readDir } from '@tauri-apps/plugin-fs';
import Library from './Library';
import './css/Home.css';

function Home({ libraryPath, setLibraryPath, session, setSession, setIsGestureDrawing, currentWindow })
{
    const [referenceFolders, setReferenceFolders] = useState({}); // all folders in the 'References' folder
    const [expandedFolders, setExpandedFolders] = useState([]); // state to keep track of which folders have been expened under 'Selected Folders'

    const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg"]; // basic image types for simplicity

    // rendering logic for the 'Selected Folders' section of the session setup
    const renderFolder = (folder) => {
        const hasSubfolders = folder.subfolders?.length > 0;
        const isExpanded = expandedFolders.includes(folder.path);
        const isSelected = session.selectedFolders.includes(folder.path);

        return (
            <div key={folder.path} className='selected-folder'>
                <div className='selected-folder-row'>
                    {hasSubfolders ? (
                        <button type="button" onClick={() => { setExpandedFolders(folders => folders.includes(folder.path) ? folders.filter(path => path !== folder.path) : [...folders, folder.path]); }}>
                            {isExpanded ? "▾" : "▸"}
                        </button>
                    ) : 
                    (
                        <span className="selected-folder-spacer"/>
                    )}

                    <label>
                        <input type="checkbox" checked={isSelected} onChange={(e) => {
                            const updatedSelection = e.target.checked ? [...session.selectedFolders, folder.path] : session.selectedFolders.filter(path => path !== folder.path);
                            setSession(session => ({...session, selectedFolders: updatedSelection}));
                        }}/>

                        <span>{folder.name}</span>
                    </label>
                </div>

                {hasSubfolders && (
                    <div className={`selected-subfolders ${isExpanded ? "expanded" : ""}`}>
                        <div className="selected-subfolders-content">
                            {folder.subfolders.map(subfolder => renderFolder(subfolder))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // start a gesture drawing session
    const startSession = async() => {
        const references = await getReferences(); // collect all references from selected folders

        if(references.length === 0)
        {
            return;
        }

        // update session fields
        setSession(session => ({
            ...session,
            references: references,
            currentIndex: 0,
            currentReference: references[0],
            shownReferences: [references[0]],
            startTime: Date.now()
        }));

        setIsGestureDrawing(true); // update gesture drawing flag
    };

    // collects all references from the selected folders, puts them into a list, deduplicates, then shuffles them
    const getReferences = async() => {
        const references = [];

        for(const folderPath of session.selectedFolders)
        {
            const folderReferences = await getReferencesFromFolder(folderPath);
            references.push(...folderReferences);
        }

        const cleanedReferences = removeDuplicates(references);

        return shuffle(cleanedReferences);
    };

    const getReferencesFromFolder = async(folderPath) => {
        const references = [];
        const entries = await readDir(folderPath);

        for(const entry of entries)
        {
            const entryPath = await join(folderPath, entry.name);

            // adds them to the list only if they are of the supported image types
            if(entry.isFile && SUPPORTED_IMAGE_EXTENSIONS.some(extension => entry.name.toLowerCase().endsWith(extension)))
            {
                references.push({name: entry.name, path: entryPath});
            }

            // recurse
            else if(entry.isDirectory)
            {
                const subfolderReferences = await getReferencesFromFolder(entryPath);
                references.push(...subfolderReferences);
            }
        }

        return references;
    };

    // if a selected folder and one of its subfolders have both been selected, ensures each reference will only be added to the list once
    const removeDuplicates = (references) => {
        const uniqueReferences = [];
        const paths = new Set();

        for(const reference of references)
        {
            if(!paths.has(reference.path))
            {
                paths.add(reference.path);
                uniqueReferences.push(reference);
            }
        }

        return uniqueReferences;
    }

    const shuffle = (array) => {
        const arr = [...array];

        for(let i = arr.length - 1; i > 0; i --)
        {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
        }

        return arr;
    }

    return (
        <>
            <div className='home'>
                <Library libraryPath={libraryPath} setLibraryPath={setLibraryPath} setReferenceFolders={setReferenceFolders} SUPPORTED_IMAGE_EXTENSIONS={SUPPORTED_IMAGE_EXTENSIONS} currentWindow={currentWindow}/>

                <div className='setup-panel'>
                    <div className='setup-header'>
                        <p>Session Setup</p>
                    </div>

                    <div className='setup-content'>
                        <div className='setup-item'>
                            <label>Mode</label>

                            <div>
                                <label>
                                    <input type="radio" name="mode" value="Manual" checked={session.mode === "Manual"} onChange={(e) => setSession(session => ({...session, mode: e.target.value}))}/>
                                    <span>Manual</span>
                                </label>
                            </div>

                            <div>
                                <label>
                                    <input type="radio" name="mode" value="Timed" checked={session.mode === "Timed"} onChange={(e) => setSession(session => ({...session, mode: e.target.value}))}/>
                                    <span>Timed</span>
                                </label>
                            </div>
                        </div>

                        <div className='setup-item'>
                            <label>Timer</label>
                            <div className='timer'>
                                <input type="number" disabled={session.mode !== "Timed"} min={1} value={session.timer} onChange={(e) => {setSession(session => ({...session, timer: e.target.value}))}} onBlur={(e) => {
                                    const value = Number(e.target.value);
                                    
                                    if(!value)
                                    {
                                        setSession(session => ({...session, timer: 30}))
                                    }

                                    else if(value < 1)
                                    {
                                        setSession(session => ({...session, timer: 1}))
                                    }
                                }}/>
                                <span>seconds</span>
                            </div>
                        </div>

                        <div className='setup-item'>
                            <label>Selected Folders</label>
                            <div className='selected-folders'>{referenceFolders && renderFolder(referenceFolders)}</div>
                        </div>

                        <button className="start-button" disabled={session.selectedFolders.length === 0 || referenceFolders.subfolders?.length === 0} onClick={async() => await startSession()}>Start</button>
                    </div>
                </div>
            </div>
        </>
    )
}

export default Home;
