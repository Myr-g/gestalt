import { join, basename } from '@tauri-apps/api/path';
import { mkdir, readDir, copyFile, exists, rename, stat, remove } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';

const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg"]; // basic image types for simplicity

// ensures the name of a folder or image is unique to avoid conflicts
async function getUniquePath(currentDir, name, extension = null)
{
    let i = 1;

    while(true)
    {
        const count = i === 1 ? "" : ` (${i})`;

        const availableName = extension ? `${name}${count}${extension}` : `${name}${count}`;
        const availablePath = await join(currentDir, availableName);

        if(!await exists(availablePath))
        {
            return availablePath;
        }

        i++;
    }
}

// makes a new folder in the current directory with the default name 'New Folder'
async function createFolder(currentDir)
{
    const folderDir = await getUniquePath(currentDir, "New Folder");

    if(!folderDir)
    {
        return null;
    }

    await mkdir(folderDir);
    return folderDir;
}

// renames an item in the current directory
async function renameItem(currentDir, path, name, extension = null)
{
    const itemPath = await getUniquePath(currentDir, name, extension);

    if(!itemPath)
    {
        return null;
    }
        
    await rename(path, itemPath);

    return itemPath;
}

// opens file dialog to select a folder to import
async function importFolderFromDialog(currentDir)
{
    const folderPath = await open({directory: true, multiple: false, recursive: true});

    if(!folderPath)
    {
        return null;
    }

    return await importFolderFromPath(currentDir, folderPath);
}

// imports a folder into the current directory from the given absolute path; recursive in case it contains subfolders
async function importFolderFromPath(currentDir, folderPath)
{
    const folderName = await basename(folderPath);
    const folderDir = await getUniquePath(currentDir, folderName);

    if(!folderDir)
    {
        return null;
    }

    await mkdir(folderDir, {recursive: true});

    const entries = await readDir(folderPath);

    for(const entry of entries)
    {
        const sourcePath = await join(folderPath, entry.name);

        if(entry.isDirectory)
        {
            await importFolderFromPath(folderDir, sourcePath);
        }

        if(entry.isFile && SUPPORTED_IMAGE_EXTENSIONS.some(extension => entry.name.toLowerCase().endsWith(extension)))
        {
            await importImageFromPath(folderDir, sourcePath);
        }
    }

    return folderDir;
}

// imports an image into the current directory from the given absolute path
async function importImageFromPath(currentDir, imagePath)
{
    const imageBasename = await basename(imagePath);
    const imageExtension = SUPPORTED_IMAGE_EXTENSIONS.find(extension => imageBasename.toLowerCase().endsWith(extension));
    const imageName = imageBasename.slice(0, -imageExtension.length);

    const imageDir = await getUniquePath(currentDir, imageName, imageExtension);

    if(!imageDir)
    {
        return null;
    }

    await copyFile(imagePath, imageDir);

    return imageDir;
}

// pastes an item into the current directory from the given absolute path; obviously the item has to still exist to work
async function pasteItem(directory, currentDir, path)
{
    const info = await stat(path);

    // ensures only folders can be imported/pasted into the top level 'References' directory
    if(directory[directory.length - 1] === "References" && !info.isDirectory)
    {
        return false;
    }

    if(info.isDirectory)
    {
        await importFolderFromPath(currentDir, path);
    }

    else if(info.isFile)
    {
        await importImageFromPath(currentDir, path);
    }

    return true;
}

// deletes the item at the given absolute path
async function deleteItem(path)
{
    try
    {
        await remove(path, { recursive: true });
        return true;
    }

    catch(error)
    {
        console.error("Failed to delete item:", error);
        return false;
    }
}

export { createFolder, importFolderFromDialog, importFolderFromPath, importImageFromPath, renameItem, pasteItem, deleteItem };