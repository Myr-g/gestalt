import { useState, useEffect, useRef } from 'react';
import { appDataDir, join } from '@tauri-apps/api/path';
import { mkdir, readDir } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from "@tauri-apps/api/core";
import { createFolder, importFolderFromDialog, importFolderFromPath, importImageFromPath, renameItem, pasteItem, deleteItem } from './LibraryFS';
import './App.css';

function Library({ libraryPath, setLibraryPath, setReferenceFolders, SUPPORTED_IMAGE_EXTENSIONS, currentWindow })
{
    const [directory, setDirectory] = useState([]);
    const [currentDirectory, setCurrentDirectory] = useState(null);
    const [editingPath, setEditingPath] = useState(null);
    const [context, setContext] = useState(null);
    const contextRef = useRef(null);
    const [clipboard, setClipboard] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);

    const loadLibrary = async() => {
        try {
            const appDir = await appDataDir();
            const referencesDir = await join(appDir, "References");
            const archiveDir = await join(appDir, "Archive");

            await mkdir(referencesDir, { recursive: true });
            await mkdir(archiveDir, { recursive: true });

            setLibraryPath(appDir);
            
            const referenceFolders = await getAllFolders(referencesDir);
            setReferenceFolders(referenceFolders);
        }

        catch(error) {
            console.error("Library data loading failed: ", error);
        }
    };

    const getAllFolders = async(folderPath, folderName = "References") => {
        const entries = await readDir(folderPath);
        const subfolders = [];

        for(const entry of entries)
        {
            if(entry.isDirectory)
            {
                const path = await join(folderPath, entry.name);
                subfolders.push(await getAllFolders(path, entry.name));
            }
        }

        return { path: folderPath, name: folderName, subfolders: subfolders };
    };

    const refreshReferenceFolders = async() => {
        const referencesDir = await join(libraryPath, "References");
        const folders = await getAllFolders(referencesDir);
        setReferenceFolders(folders);
    };

    const countReferences = async(folderPath) => {
        const entries = await readDir(folderPath);
        const references = entries.filter(entry => entry.isFile && SUPPORTED_IMAGE_EXTENSIONS.some(extension =>
            entry.name.toLowerCase().endsWith(extension)
        ));

        return references.length;
    };

    const loadDirectory = async(folderPath) => {
        const entries = await readDir(folderPath);

        const folders = [];
        const images = [];

        for(const entry of entries)
        {
            if(entry.isDirectory)
            {
                const subfolderPath = await join(folderPath, entry.name);
                const refCount = await countReferences(subfolderPath);

                folders.push({path: subfolderPath, name: entry.name, referenceCount: refCount});
            }

            else if(entry.isFile && SUPPORTED_IMAGE_EXTENSIONS.some(extension => entry.name.toLowerCase().endsWith(extension)))
            {
                const imagePath = await join(folderPath, entry.name);
                const imageExtension = SUPPORTED_IMAGE_EXTENSIONS.find(extension => entry.name.toLowerCase().endsWith(extension));
                const imageName = entry.name.slice(0, -imageExtension.length);

                images.push({path: imagePath, name: imageName, extension: imageExtension});
            }
        }

        return {path: folderPath, folders, images};
    };

    const openDirectory = async(breadcrumbTrail) => {
        if(breadcrumbTrail.length === 0) 
        {
            setCurrentDirectory(null);
            setDirectory([]);
            return;
        }

        const path = await join(libraryPath, ...breadcrumbTrail);
        const dir = await loadDirectory(path);
        setCurrentDirectory(dir);
        setDirectory(breadcrumbTrail);
    };

    useEffect(() => {
        loadLibrary();
    }, []);

    useEffect(() => {
        if (!previewImage) return;

        const handleKeyDown = (e) => {
            if(e.key === "Escape")
            {
                setPreviewImage(null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [previewImage]);

    useEffect(() => {
        function closeContextMenu(e) 
        {
            if(contextRef.current && !contextRef.current.contains(e.target))
            {
                setContext(null);
            }
        }

        if(context) 
        {
            document.addEventListener("mousedown", closeContextMenu);
            document.addEventListener("touchstart", closeContextMenu);
        }

        return () => {
            document.removeEventListener("mousedown", closeContextMenu);
            document.removeEventListener("touchstart", closeContextMenu);
        };
    }, [context]);

    useEffect(() => {
        const setup = async () => {
            const unlisten = await currentWindow.onDragDropEvent(async(event) => {
                if(event.payload.type === "drop")
                {
                    if(directory[0] !== "References")
                    {
                        return;
                    }

                    for(const path of event.payload.paths)
                    {
                        await pasteItem(directory, currentDirectory.path, path);
                    }

                    await openDirectory(directory);
                }
            });

            return unlisten;
        };

        let cleanup;

        setup().then(unlisten => {
            cleanup = unlisten;
        });

        return () => {
            cleanup?.();
        };
    }, [directory]);

    return (
        <>
            <div className='library'>
                <div className='library-header'>
                    <div className='breadcrumb-trail'>
                        <span className='breadcrumb' onClick={async() => await openDirectory([])}>Library</span>

                        {directory.map((segment, index) => (
                            <span key={index}>
                                <span className='separator'>/ </span>
                                <span className='breadcrumb' onClick={async() => await openDirectory(directory.slice(0, index + 1))}>{segment}</span>
                            </span>
                        ))}
                    </div>
                </div>

                <div className={`library-content ${currentDirectory === null ? "" : "subdirectory"}`} onContextMenu={(e) => {
                    e.preventDefault();

                    if(directory.length === 0 || previewImage)
                    {
                        return;
                    }
                    
                    setContext({path: null, x: e.clientX, y: e.clientY});
                }}>
                    {!currentDirectory && (
                        <>
                            <div className='library-root'>
                                <div className='folder' onClick={async() => await openDirectory(["References"])}>
                                    <h2>References</h2>
                                </div>

                                <div className='folder' onClick={async() => await openDirectory(["Archive"])}>
                                    <h2>Archive</h2>
                                </div>
                            </div>
                        </>
                    )}

                    {currentDirectory && (
                        <>
                            <div className='actions'>
                                <button className='back-button' onClick={async() => await openDirectory(directory.slice(0, -1))}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
                                        <path d="M0 0h24v24H0z" fill="none" />
	                                    <path fill="currentColor" d="M16.62 2.99a1.25 1.25 0 0 0-1.77 0L6.54 11.3a.996.996 0 0 0 0 1.41l8.31 8.31c.49.49 1.28.49 1.77 0s.49-1.28 0-1.77L9.38 12l7.25-7.25c.48-.48.48-1.28-.01-1.76" />
                                    </svg>
                                </button>

                                {directory.includes("References") && (
                                    <>
                                        <button className='new-folder-button' onClick={async() => {
                                            const folderDir = await createFolder(currentDirectory.path);

                                            if(folderDir)
                                            {
                                                await openDirectory(directory);
                                                await refreshReferenceFolders();
                                                setEditingPath(folderDir);
                                            }
                                        }}>New Folder</button>

                                        <button className='import-button' onClick={async() => {
                                            if(await importFolderFromDialog(currentDirectory.path))
                                            {
                                               await openDirectory(directory);
                                               await refreshReferenceFolders(); 
                                            }
                                        }}>Import Folder</button>
                                    </>
                                )}
                            </div>

                            {currentDirectory.folders.length > 0 && (
                                <div className='folders'>
                                    {currentDirectory.folders.map((folder) => (
                                        <div key={folder.path} className={`folder ${context ? context.path === folder.path ? "selected" : "" : ""}`} onClick={async() => await openDirectory([...directory, folder.name])} onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setContext({path: folder.path, x: e.clientX, y: e.clientY});
                                        }}>
                                            {editingPath === folder.path ? (
                                                <input autoFocus onFocus={(e) => e.target.select()} defaultValue={folder.name} onClick={(e) => e.stopPropagation()}
                                                    onBlur={async(e) => {
                                                        const newName = e.target.value.trim();

                                                        if(newName === folder.name)
                                                        {
                                                            setEditingPath(null);
                                                            return;
                                                        }


                                                        if(await renameItem(currentDirectory.path, folder.path, newName || "New Folder"))
                                                        {
                                                            await openDirectory(directory);
                                                            await refreshReferenceFolders();
                                                            setEditingPath(null);
                                                        }
                                                    }}

                                                    onKeyDown={(e) => {
                                                        if(e.key === "Enter")
                                                        {
                                                            e.currentTarget.blur();
                                                        }

                                                        if(e.key === "Escape")
                                                        {
                                                            setEditingPath(null);
                                                        }
                                                    }}
                                                />
                                            ) :
                                            (
                                                <h2>{folder.name}</h2>
                                            )}
                                            
                                            <p>{folder.referenceCount} references</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {currentDirectory.images.length > 0 && (
                                <div className='images'>
                                    {currentDirectory.images.map((image) => (
                                        <div key={image.path} className={`image ${context ? context.path === image.path ? "selected" : "" : ""}`} onDoubleClick={() => setPreviewImage(image)} onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setContext({path: image.path, x: e.clientX, y: e.clientY});
                                        }}>
                                            <img src={convertFileSrc(image.path)} alt={image.name} loading="lazy" decoding="async"/>

                                            {editingPath === image.path ? (
                                                <input autoFocus onFocus={(e) => e.target.select()} defaultValue={image.name} onClick={(e) => e.stopPropagation()} onDoubleClick={(e)=> e.stopPropagation()}
                                                    onBlur={async(e) => { 
                                                        const newName = e.target.value.trim();

                                                        if(newName === image.name)
                                                        {
                                                            setEditingPath(null);
                                                            return;
                                                        }

                                                        if(await renameItem(currentDirectory.path, image.path, newName || "New Image", image.extension))
                                                        {
                                                            await openDirectory(directory);
                                                            await refreshReferenceFolders();
                                                            setEditingPath(null);
                                                        }
                                                    }}

                                                    onKeyDown={(e) => {
                                                        if(e.key === "Enter")
                                                        {
                                                            e.currentTarget.blur();
                                                        }

                                                        if(e.key === "Escape")
                                                        {
                                                            setEditingPath(null);
                                                        }
                                                    }}
                                                />
                                            ) :
                                            (
                                                <p>{image.name}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {context && (
                                <div ref={contextRef} className='context-menu' style={{ left: context.x, top: context.y }}>
                                    <button disabled={!context.path} onClick={() => {
                                        setEditingPath(context.path);
                                        setContext(null);
                                    }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 16 16">
	                                        <path d="M0 0h16v16H0z" fill="none" />
	                                        <path fill="var(--accent)" d="M8 .5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1H11v14h1.5a.5.5 0 0 1 0 1h-4a.5.5 0 0 1 0-1H10V1H8.5A.5.5 0 0 1 8 .5" />
	                                        <path fill="var(--accent)" fillRule="evenodd" d="M5.46 4.31a.501.501 0 0 0-.924 0l-2.5 6a.5.5 0 0 0 .923.385l.705-1.69h2.67l.705 1.69a.5.5 0 0 0 .923-.385l-2.5-6zM4.998 5.8L5.915 8h-1.83l.917-2.2z" clipRule="evenodd" />
	                                        <path fill="currentColor" d="M8.5 3a.5.5 0 0 0 0-1H4.8c-1.68 0-2.52 0-3.16.327a3.02 3.02 0 0 0-1.31 1.31c-.327.642-.327 1.48-.327 3.16v2.4c0 1.68 0 2.52.327 3.16a3.02 3.02 0 0 0 1.31 1.31c.642.327 1.48.327 3.16.327h3.7a.5.5 0 0 0 0-1H4.8c-.857 0-1.44 0-1.89-.038c-.438-.035-.663-.1-.819-.18a2 2 0 0 1-.874-.874c-.08-.156-.145-.38-.18-.819c-.037-.45-.038-1.03-.038-1.89v-2.4c0-.857.001-1.44.038-1.89c.036-.438.101-.663.18-.819c.192-.376.498-.682.874-.874c.156-.08.381-.145.819-.18c.45-.036 1.03-.037 1.89-.037h3.7zm4 10a.506.506 0 0 0-.496.504c0 .278.226.503.504.496c.863-.02 1.41-.09 1.86-.318a3 3 0 0 0 1.31-1.31c.327-.642.327-1.48.327-3.16v-2.4c0-1.68 0-2.52-.327-3.16a3 3 0 0 0-1.31-1.31c-.449-.229-.995-.298-1.86-.318a.494.494 0 0 0-.504.496c0 .275.222.497.496.504q.333.007.592.029c.438.035.663.1.819.18c.376.192.682.498.874.874c.08.156.145.38.18.819c.037.45.038 1.03.038 1.89v2.4c0 .857-.001 1.44-.038 1.89c-.036.438-.101.663-.18.819a2 2 0 0 1-.874.874c-.156.08-.381.145-.819.18q-.26.02-.592.028z" />
                                        </svg>
                                        <p>Rename</p>
                                    </button>

                                    <button disabled={!context.path} onClick={() => {
                                        setClipboard(context);
                                        setContext(null);
                                    }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 16 16">
                                            <path d="M0 0h16v16H0z" fill="none" />
                                            <path fill="var(--accent)" fillRule="evenodd" d="M7.5 3A2.5 2.5 0 0 0 5 5.5v8A2.5 2.5 0 0 0 7.5 16h6a2.5 2.5 0 0 0 2.5-2.5v-8A2.5 2.5 0 0 0 13.5 3zM6 5.5A1.5 1.5 0 0 1 7.5 4h6A1.5 1.5 0 0 1 15 5.5v8a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 6 13.5z" clipRule="evenodd" />
                                            <path fill="currentColor" d="M0 2.5A2.5 2.5 0 0 1 2.5 0h6c.979 0 1.83.562 2.24 1.38c.152.303-.104.618-.443.618c-.227 0-.422-.149-.549-.338a1.5 1.5 0 0 0-1.24-.662h-6a1.5 1.5 0 0 0-1.5 1.5v8a1.5 1.5 0 0 0 1.5 1.5h1a.5.5 0 0 1 0 1h-1a2.5 2.5 0 0 1-2.5-2.5v-8z" />
                                        </svg>
                                        <p>Copy</p>
                                    </button>

                                    <button disabled={!clipboard} onClick={async() => { 
                                        if(await pasteItem(directory, currentDirectory.path, clipboard.path))
                                        {
                                            await openDirectory(directory);
                                            setClipboard(null); 
                                        }
                                            
                                        setContext(null);
                                    }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 16 16">
	                                        <path d="M0 0h16v16H0z" fill="none" />
	                                        <path fill="var(--accent)" fillRule="evenodd" d="M14 8h-4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1m-4-1c-1.1 0-2 .895-2 2v5c0 1.1.895 2 2 2h4c1.1 0 2-.895 2-2V9c0-1.1-.895-2-2-2z" clipRule="evenodd" />
	                                        <path fill="currentColor" fillRule="evenodd" d="M9 3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h5v1H2c-1.1 0-2-.895-2-2V4c0-1.1.895-2 2-2h1a1 1 0 0 1 1-1h.268a1.998 1.998 0 0 1 3.46 0h.268a1 1 0 0 1 1 1h1c1.1 0 2 .895 2 2v2h-1V4a1 1 0 0 0-1-1h-1zM4.27 2a1 1 0 0 0 .866-.499a1 1 0 0 1 1.734 0A1 1 0 0 0 7.736 2h.018a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-3.5a.25.25 0 0 1-.25-.25v-.5a.25.25 0 0 1 .25-.25h.017z" clipRule="evenodd" />
                                        </svg>
                                        <p>Paste</p>
                                    </button>

                                    <button disabled={!context.path} onClick={async() => {
                                        if(await deleteItem(context.path))
                                        {
                                            await openDirectory(directory);
                                            await refreshReferenceFolders();
                                            setContext(null);
                                        }
                                    }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
                                            <path d="M0 0h24v24H0z" fill="none" />
	                                        <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16l-1.58 14.22A2 2 0 0 1 16.432 22H7.568a2 2 0 0 1-1.988-1.78zm3.345-2.853A2 2 0 0 1 9.154 2h5.692a2 2 0 0 1 1.81 1.147L18 6H6zM2 6h20m-12 5v5m4-5v5" />
                                        </svg>
                                        <p>Delete</p>
                                    </button>
                                </div>
                            )}

                            {previewImage && (
                                <div className='preview-image-overlay' onClick={() => setPreviewImage(null)}>
                                    <div className='preview-image' onClick={(e) => e.stopPropagation()}>
                                        <img src={convertFileSrc(previewImage.path)} alt={previewImage.name}></img> 
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    )
}

export default Library;