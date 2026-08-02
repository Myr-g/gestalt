# Gestalt
Gestalt is a small desktop app meant to make drawing feel less mentally taxing. It requires no account and doesn't store or upload your data elsewhere.

It’s for artists who want to practice without stopping every few minutes to look for the next reference. It handles the swapping so you can continue drawing uninterrupted.

## Features
- Local reference library
- Folder-based reference organization
- Drag-and-drop importing
- Manual and timed practice sessions
- Zoom and pan reference viewport
- Session summaries
- Reference archiving
- Light and dark themes

## How does it work?
- Click the 'Import Folder' button and select the folder that has your references or drag-and-drop them in to do multiple folders and/or images at once.
- Gestalt copies them into its own library (located in AppData/Roaming) so it can manage references without modifying the original folders.
- Choose a mode:
  - **Manual mode** - Use arrow keys to cycle through references.
  - **Timed mode** - References are cycled automatically when the timer reaches 0.
- Every folder you select has its contents added to a list and shuffled.
- While practicing, Gestalt will then display those refs for you.
- When you end the session, you'll be shown a simple summary:
  - How long you practiced.  
  - How many references were shown. 
  - Which folders were pulled from. 
  - Thumbnails of the refs that were shown
- You can then choose to move all, some, or none of the shown references to the 'Archive' folder.  

## Tech
Gestalt is made with:

- JavaScript
- React
- Vite
- Tauri
- Rust

## Running (Development)
Clone the repo:
```
git clone https://github.com/Myr-g/gestalt
cd gestalt
```

Install dependencies:
```
npm install
```

Build:
```
npm run tauri build
```

Start the app:
```
npm run tauri dev
```

## Download

Download the latest release from the GitHub Releases page.

Currently available for Windows.
