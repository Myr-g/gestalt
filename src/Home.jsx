import { useState, useEffect } from 'react'
import { join } from '@tauri-apps/api/path';
import { readDir } from '@tauri-apps/plugin-fs';
import './App.css'
import Library from './Library';

function Home({ libraryPath, setLibraryPath, session, setSession, setIsPracticing, window })
{
    const [referenceFolders, setReferenceFolders] = useState([]);

    const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg"];

    const startSession = async() => {
        const references = await getReferences();

        if (references.length === 0)
        {
            return;
        }

        setSession(session => ({
            ...session,
            references: references,
            currentIndex: 0,
            currentReference: references[0],
            shownReferences: [references[0]],
            startTime: Date.now()
        }));

        setIsPracticing(true);
    };

    const getReferences = async() => {
        const references = [];

        for(const folderPath of session.selectedFolders)
        {
            const entries = await readDir(folderPath);

            for(const entry of entries)
            {
                if(entry.isFile && SUPPORTED_IMAGE_EXTENSIONS.some(extension => entry.name.toLowerCase().endsWith(extension)))
                {
                    const imagePath = await join(folderPath, entry.name);
                    references.push({name: entry.name, path: imagePath});
                }
            }
        }

        return shuffle(references);
    };

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
                <Library libraryPath={libraryPath} setLibraryPath={setLibraryPath} setReferenceFolders={setReferenceFolders} SUPPORTED_IMAGE_EXTENSIONS={SUPPORTED_IMAGE_EXTENSIONS} currentWindow={window}/>

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
                                <input type="number" disabled={session.mode !== "Timed"} min={1} value={session.timer} onChange={(e) => {setSession(session => ({...session, timer: e.target.value}))}}/>
                                <span>seconds</span>
                            </div>
                        </div>

                        <div className='setup-item'>
                            <label>Selected Folders</label>
                            <div className='selected-folders'>
                                {referenceFolders.map(folder => (
                                    <label key={folder.path}>
                                        <input type='checkbox' checked={session.selectedFolders.includes(folder.path)} onChange={(e) => {
                                            const updatedSelection = e.target.checked ? [...session.selectedFolders, folder.path] : session.selectedFolders.filter(folders => folders !== folder.path);
                                            setSession(session => ({...session, selectedFolders: updatedSelection}));
                                        }}/>
                                        <span>{folder.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <button className="start-practice" disabled={session.selectedFolders.length === 0} onClick={async() => await startSession()}>Start</button>
                    </div>
                </div>
            </div>
        </>
    )
}

export default Home;