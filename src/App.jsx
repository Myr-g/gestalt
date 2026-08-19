import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Home from './Home';
import GestureDrawing from './GestureDrawing';
import './css/App.css';

function App() 
{
  const [libraryPath, setLibraryPath] = useState(null); // location of the app's library in AppData
  
  // relevant fields for the gesture drawing session
  const [session, setSession] = useState({
    mode: "Manual",
    timer: 30,
    selectedFolders: [],

    references: [],
    currentIndex: 0,
    currentReference: null,
    shownReferences: [],
    startTime: null
  });

  const [isGestureDrawing, setIsGestureDrawing] = useState(false); // flag to change screen from home to gesture drawing

  const [showSettings, setShowSettings] = useState(false); // flag to show settings panel

  // theme toggling
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "Dark";
  });

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // default shortcut keys
  const defaultShortcuts = {
    rotateClockwise: "ArrowUp",
    rotateCounterClockwise: "ArrowDown",
    previousReference: "ArrowLeft",
    nextReference: "ArrowRight",
    pauseTimer: " ",
    endSession: "Escape",
  };

  // shortkey key mapping
  const [shortcuts, setShortcuts] = useState(() => {
    const shortcutSettings = localStorage.getItem("shortcutSettings");
    return shortcutSettings ? JSON.parse(shortcutSettings) : defaultShortcuts;
  });

  // update shortcut settings when one is changed
  useEffect(() => {
    localStorage.setItem("shortcutSettings", JSON.stringify(shortcuts));
  }, [shortcuts]);

  const [changingShortcut, setChangingShortcut] = useState(null);

  useEffect(() => {
    if(!changingShortcut)
    {
      return;
    }
    
    const handleShortcutChange = (e) => {
      e.preventDefault();

      // whitelisted keys
      const validShortcutKey = /^[a-zA-Z0-9]$/.test(e.key) || ["Escape", "Backspace", "Enter", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key);

      if(!validShortcutKey)
      {
        return;
      }

      const isLetter = /^[a-zA-Z]$/.test(e.key);
      const shortcutKey = isLetter ? e.key.toLowerCase() : e.key; // normalize to lowercase if the key is a letter

      setShortcuts(shortcuts => ({...shortcuts, [changingShortcut]: shortcutKey}));
      setChangingShortcut(null);
    };

    window.addEventListener("keydown", handleShortcutChange);

    return () => {
      window.removeEventListener("keydown", handleShortcutChange);
    };
  }, [changingShortcut]);

  const displayShortcutKey = (key) => {
    if(key === " ")
    {
      return "Space";
    }

    if(/^[a-z]$/.test(key)) 
    {
      return key.toUpperCase();
    }

    if(key.includes("Arrow"))
    {
      return key.substring(5, key.length);
    }

    return key;
  };

  const currentWindow = getCurrentWindow(); // for minimize, maximize, close, drag & drop, etc.

  return (
    <>
      <div className='container' onContextMenu={(e) => e.preventDefault()}>
        <div className='title-bar'>
          <p className='title-bar-app-name'>Gestalt</p>

          <div className='title-bar-actions'>
            <button onClick={() => currentWindow.minimize()}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
	              <path d="M0 0h16v16H0z" fill="none" />
	              <path fill="currentColor" d="M3 8a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 8" />
              </svg>
            </button>

            <button onClick={() => currentWindow.toggleMaximize()}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
	              <path d="M0 0h16v16H0z" fill="none" />
	              <path fill="currentColor" d="M4.5 3A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13h7a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 11.5 3zm0 1h7a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-7a.5.5 0 0 1 .5-.5" />
              </svg>
            </button>

            <button onClick={() => currentWindow.close()}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 1024 1024">
	              <path d="M0 0h1024v1024H0z" fill="none" />
	              <path fill="currentColor" d="M764.3 214.6L512 466.9L259.7 214.6a32 32 0 0 0-45.1 45.1L466.8 512L214.5 764.2a32 32 0 1 0 45.1 45.2L512 557.2l252.3 252.3a32 32 0 0 0 45.1-45.1L557.1 512l252.3-252.4a32 32 0 1 0-45.1-45.2z" />
              </svg>
            </button>
          </div>
        </div>

        <div className='header'>
          <span className='app-name'>Gestalt</span>

          <div className='settings-toggle' onClick={() => setShowSettings(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 512 512">
	            <path d="M0 0h512v512H0z" fill="none" />
	            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32" d="M262.29 192.31a64 64 0 1 0 57.4 57.4a64.13 64.13 0 0 0-57.4-57.4M416.39 256a154 154 0 0 1-1.53 20.79l45.21 35.46a10.81 10.81 0 0 1 2.45 13.75l-42.77 74a10.81 10.81 0 0 1-13.14 4.59l-44.9-18.08a16.11 16.11 0 0 0-15.17 1.75A164.5 164.5 0 0 1 325 400.8a15.94 15.94 0 0 0-8.82 12.14l-6.73 47.89a11.08 11.08 0 0 1-10.68 9.17h-85.54a11.11 11.11 0 0 1-10.69-8.87l-6.72-47.82a16.07 16.07 0 0 0-9-12.22a155 155 0 0 1-21.46-12.57a16 16 0 0 0-15.11-1.71l-44.89 18.07a10.81 10.81 0 0 1-13.14-4.58l-42.77-74a10.8 10.8 0 0 1 2.45-13.75l38.21-30a16.05 16.05 0 0 0 6-14.08c-.36-4.17-.58-8.33-.58-12.5s.21-8.27.58-12.35a16 16 0 0 0-6.07-13.94l-38.19-30A10.81 10.81 0 0 1 49.48 186l42.77-74a10.81 10.81 0 0 1 13.14-4.59l44.9 18.08a16.11 16.11 0 0 0 15.17-1.75A164.5 164.5 0 0 1 187 111.2a15.94 15.94 0 0 0 8.82-12.14l6.73-47.89A11.08 11.08 0 0 1 213.23 42h85.54a11.11 11.11 0 0 1 10.69 8.87l6.72 47.82a16.07 16.07 0 0 0 9 12.22a155 155 0 0 1 21.46 12.57a16 16 0 0 0 15.11 1.71l44.89-18.07a10.81 10.81 0 0 1 13.14 4.58l42.77 74a10.8 10.8 0 0 1-2.45 13.75l-38.21 30a16.05 16.05 0 0 0-6.05 14.08c.33 4.14.55 8.3.55 12.47" />
            </svg>
          </div>
        </div>

        <div className='content'>
          {!isGestureDrawing && (
            <Home libraryPath={libraryPath} setLibraryPath={setLibraryPath} session={session} setSession={setSession} setIsGestureDrawing={setIsGestureDrawing} currentWindow={currentWindow}/>
          )}

          {isGestureDrawing && (
            <GestureDrawing libraryPath={libraryPath} session={session} setSession={setSession} setIsGestureDrawing={setIsGestureDrawing} shortcuts={shortcuts}/>
          )}
        </div>

        {showSettings && (
          <div className='settings-overlay' onClick={() => {setShowSettings(false); setChangingShortcut(null); }}>
            <div className='settings' onClick={(e) => e.stopPropagation()}>
              <h2>Settings</h2>

              <div className='settings-theme'>
                <label className='settings-section-title'>Appearance</label>
                <div className='settings-theme-toggle' onClick={() => setTheme(theme === "Dark" ? "Light" : "Dark")}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 32 32">
	                  <path d="M0 0h32v32H0z" fill="none" />
	                  <path fill="currentColor" d="M15.653 7.25c-3.417 0-8.577.983-8.577 3.282c0 1.91 2.704 3.23 1.69 3.89c-1.02.665-2.683-1.85-4.047-1.85c-1.654 0-2.816 1.435-2.816 2.927c0 4.557 6.326 8.25 13.75 8.25c7.423 0 13.442-3.693 13.442-8.25c0-4.556-6.02-8.25-13.443-8.25zm-5.345 6.27c0-.644.887-1.165 1.98-1.165s1.98.52 1.98 1.166s-.887 1.167-1.98 1.167s-1.98-.523-1.98-1.166zm3.98 8.78c-1.057 0-1.913-.68-1.913-1.52s.856-1.517 1.914-1.517c1.056 0 1.913.68 1.913 1.518s-.857 1.52-1.914 1.52zm5.323-.53c-1.056 0-1.912-.68-1.912-1.518c0-.84.856-1.52 1.913-1.52c1.06 0 1.915.68 1.915 1.52s-.855 1.52-1.914 1.52zm.465-11.11c0-.838.856-1.518 1.914-1.518s1.912.68 1.912 1.518c0 .84-.855 1.518-1.913 1.518c-1.056 0-1.915-.68-1.915-1.518zm4.2 8.822c-1.057 0-1.914-.68-1.914-1.52s.858-1.517 1.915-1.517c1.06 0 1.914.68 1.914 1.518s-.856 1.52-1.915 1.52zm1.01-4.007c-1.057 0-1.913-.68-1.913-1.52c0-.837.856-1.517 1.914-1.517s1.913.68 1.913 1.518c0 .84-.857 1.52-1.914 1.52z" />
                  </svg>
                  <span>{theme}</span>
                </div>
              </div>

              <div className='settings-shortcuts'>
                <label className='settings-section-title'>Shortcuts</label>

                <div className='settings-shortcuts-item'>
                  <p className='shortcut-action'>Rotate Clockwise</p>
                  <p className='shortcut-key' onClick={() => setChangingShortcut("rotateClockwise")}>{changingShortcut === "rotateClockwise" ? "Press a key..." : displayShortcutKey(shortcuts.rotateClockwise)}</p>
                </div>

                <div className='settings-shortcuts-item'>
                  <p className='shortcut-action'>Rotate Counter-Clockwise</p>
                  <p className='shortcut-key' onClick={() => setChangingShortcut("rotateCounterClockwise")}>{changingShortcut === "rotateCounterClockwise" ? "Press a key..." : displayShortcutKey(shortcuts.rotateCounterClockwise)}</p>
                </div>

                <div className='settings-shortcuts-item'>
                  <p className='shortcut-action'>Previous Reference</p>
                  <p className='shortcut-key' onClick={() => setChangingShortcut("previousReference")}>{changingShortcut === "previousReference" ? "Press a key..." : displayShortcutKey(shortcuts.previousReference)}</p>
                </div>

                <div className='settings-shortcuts-item'>
                  <p className='shortcut-action'>Next Reference</p>
                  <p className='shortcut-key' onClick={() => setChangingShortcut("nextReference")}>{changingShortcut === "nextReference" ? "Press a key..." : displayShortcutKey(shortcuts.nextReference)}</p>
                </div>

                <div className='settings-shortcuts-item'>
                  <p className='shortcut-action'>Pause Timer</p>
                  <p className='shortcut-key' onClick={() => setChangingShortcut("pauseTimer")}>{changingShortcut === "pauseTimer" ? "Press a key..." : displayShortcutKey(shortcuts.pauseTimer)}</p>
                </div>

                <div className='settings-shortcuts-item'>
                  <p className='shortcut-action'>End Session</p>
                  <p className='shortcut-key' onClick={() => setChangingShortcut("endSession")}>{changingShortcut === "endSession" ? "Press a key..." : displayShortcutKey(shortcuts.endSession)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default App
