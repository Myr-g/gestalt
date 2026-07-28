# Gestalt
*A quiet little reference tool for art practice.*

Gestalt is a small desktop app meant to make art studies feel less mentally taxing. It requires no account and never stores or uploads your data elsewhere.

It’s for artists who want to practice without stopping every few minutes to look for the next reference. It handles the swapping so you can continue drawing uninterrupted.

## How does it work?
- You click the 'import folder' button and select the folder(s) that have your references
- Gestalt copies the folder(s) into its own library (located in AppData/Roaming), leaving your original files untouched
- You choose how you want to practice:
  - **Manual mode** - use arrow keys to cycle through refs
  - **Timer mode** - refs are cycled automatically  
- Every folder you select to have refs pulled from have their contents added to a list
- While practicing, Gestalt will pull references at random from that list to display
- When you end the session, you'll be shown a simple summary:
  - How long you practiced  
  - How many references were shown  
  - Which folders were pulled from 
  - Thumbnails of the refs that were shown
- You can choose from the following options to move to the 'archive' folder:
  - **All** of them  
  - **Some** of them (you can choose specifically)
  - **None** of them  

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
