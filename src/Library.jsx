import { useState, useEffect } from 'react';
import { appDataDir, join, basename } from '@tauri-apps/api/path';
import { mkdir, readDir, copyFile } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from '@tauri-apps/plugin-dialog';
import './App.css';

function Library({ libraryPath, setLibraryPath, setReferenceFolders, SUPPORTED_IMAGE_EXTENSIONS })
{
    const [directory, setDirectory] = useState([]);
    const [currentDirectory, setCurrentDirectory] = useState(null);
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

    const getAllFolders = async(referencesPath) => {
        const folders = [];

        const recurse = async(folderPath) => {
            const entries = await readDir(folderPath);

            for(const entry of entries)
            {
                if(entry.isDirectory)
                {
                    const path = await join(folderPath, entry.name);
                    const refCount = await countReferences(path);

                    folders.push({name: entry.name, path: path, referenceCount: refCount});

                    await recurse(path);
                }
            }
        };

        await recurse(referencesPath);
        return folders;
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

                folders.push({name: entry.name, path: subfolderPath, referenceCount: refCount});
            }

            else if(entry.isFile && SUPPORTED_IMAGE_EXTENSIONS.some(extension => entry.name.toLowerCase().endsWith(extension)))
            {
                const imagePath = await join(folderPath, entry.name);
                images.push({name: entry.name, path: imagePath});
            }
        }

        return {folders, images};
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

    const importFolder = async() => {
        const folderPath = await open({directory: true, multiple: false});

        if(!folderPath)
        {
            return;
        }

        const folderName = await basename(folderPath);

        const referencesDir = await join(libraryPath, ...directory);
        const folderDir = await join(referencesDir, folderName);

        await mkdir(folderDir, {recursive: true});

        const entries = await readDir(folderPath);

        let refCount = 0;

        for(const entry of entries)
        {
            if(entry.isFile && SUPPORTED_IMAGE_EXTENSIONS.some(extension => entry.name.toLowerCase().endsWith(extension)))
            {
                const entryPath = await join(folderPath, entry.name);
                const destPath = await join (folderDir, entry.name);
                await copyFile(entryPath, destPath);
                refCount += 1;
            }
        }

        await openDirectory(directory);

        const newFolder = {
            name: folderName,
            path: folderDir,
            referenceCount: refCount
        };

        setReferenceFolders(referenceFolders => referenceFolders.some(folder => folder.path === folderDir) ? referenceFolders : [...referenceFolders, newFolder]);
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

                <div className={`library-content ${currentDirectory === null ? "" : "subdirectory"}`}>
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
                                <button className='back-button' onClick={() => openDirectory(directory.slice(0, -1))}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
                                        <path d="M0 0h24v24H0z" fill="none" />
	                                    <path fill="currentColor" d="M16.62 2.99a1.25 1.25 0 0 0-1.77 0L6.54 11.3a.996.996 0 0 0 0 1.41l8.31 8.31c.49.49 1.28.49 1.77 0s.49-1.28 0-1.77L9.38 12l7.25-7.25c.48-.48.48-1.28-.01-1.76" />
                                    </svg>
                                </button>

                                {directory.includes("References") && (
                                    <button className='import-button' onClick={() => importFolder()}>Import Folder</button>
                                )}
                            </div>

                            {currentDirectory.folders.length > 0 && (
                                <div className='folders'>
                                    {currentDirectory.folders.map((folder) => (
                                        <div key={folder.path} className='folder' onClick={async() => openDirectory([...directory, folder.name])}>
                                            <h2>{folder.name}</h2>
                                            <p>{folder.referenceCount} references</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {currentDirectory.images.length > 0 && (
                                <div className='images'>
                                    {currentDirectory.images.map((image) => (
                                        <div key={image.path} className='image'>
                                            <img src={convertFileSrc(image.path)} alt={image.name} onDoubleClick={() => setPreviewImage(image)}></img>
                                            <p>{image.name}</p>
                                        </div>
                                    ))}
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