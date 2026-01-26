// Input handling system

const Input = {
    keys: {},
    keysJustPressed: {}, // Track keys that were just pressed this frame
    keysPrevious: {}, // Previous frame's key state
    mouse: {
        x: 0,
        y: 0,
        pressed: false,
        button: -1
    },
    touch: {
        x: 0,
        y: 0,
        active: false
    }
};

// Store event handler references for cleanup
let inputCanvas = null;
let keydownHandler = null;
let keyupHandler = null;
let mousedownHandler = null;
let mouseupHandler = null;
let mousemoveHandler = null;
let touchstartHandler = null;
let touchendHandler = null;
let touchmoveHandler = null;

// Initialize input handlers
function initInput(canvas) {
    inputCanvas = canvas;

    // Keyboard input
    keydownHandler = (e) => {
        Input.keys[e.key.toLowerCase()] = true;
    };
    window.addEventListener('keydown', keydownHandler);

    keyupHandler = (e) => {
        Input.keys[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keyup', keyupHandler);

    // Mouse input
    mousedownHandler = (e) => {
        const rect = canvas.getBoundingClientRect();
        Input.mouse.x = e.clientX - rect.left;
        Input.mouse.y = e.clientY - rect.top;
        Input.mouse.pressed = true;
        Input.mouse.button = e.button;
    };
    canvas.addEventListener('mousedown', mousedownHandler);

    mouseupHandler = () => {
        Input.mouse.pressed = false;
        Input.mouse.button = -1;
    };
    canvas.addEventListener('mouseup', mouseupHandler);

    mousemoveHandler = (e) => {
        const rect = canvas.getBoundingClientRect();
        Input.mouse.x = e.clientX - rect.left;
        Input.mouse.y = e.clientY - rect.top;
    };
    canvas.addEventListener('mousemove', mousemoveHandler);

    // Touch input
    touchstartHandler = (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        Input.touch.x = touch.clientX - rect.left;
        Input.touch.y = touch.clientY - rect.top;
        Input.touch.active = true;
    };
    canvas.addEventListener('touchstart', touchstartHandler);

    touchendHandler = (e) => {
        e.preventDefault();
        Input.touch.active = false;
    };
    canvas.addEventListener('touchend', touchendHandler);

    touchmoveHandler = (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        Input.touch.x = touch.clientX - rect.left;
        Input.touch.y = touch.clientY - rect.top;
    };
    canvas.addEventListener('touchmove', touchmoveHandler);

    console.log('Input system initialized');
}

// Cleanup input handlers to prevent memory leaks
function cleanupInput() {
    if (keydownHandler) {
        window.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
    }
    if (keyupHandler) {
        window.removeEventListener('keyup', keyupHandler);
        keyupHandler = null;
    }
    if (inputCanvas) {
        if (mousedownHandler) {
            inputCanvas.removeEventListener('mousedown', mousedownHandler);
            mousedownHandler = null;
        }
        if (mouseupHandler) {
            inputCanvas.removeEventListener('mouseup', mouseupHandler);
            mouseupHandler = null;
        }
        if (mousemoveHandler) {
            inputCanvas.removeEventListener('mousemove', mousemoveHandler);
            mousemoveHandler = null;
        }
        if (touchstartHandler) {
            inputCanvas.removeEventListener('touchstart', touchstartHandler);
            touchstartHandler = null;
        }
        if (touchendHandler) {
            inputCanvas.removeEventListener('touchend', touchendHandler);
            touchendHandler = null;
        }
        if (touchmoveHandler) {
            inputCanvas.removeEventListener('touchmove', touchmoveHandler);
            touchmoveHandler = null;
        }
        inputCanvas = null;
    }

    // Reset input state
    Input.keys = {};
    Input.keysJustPressed = {};
    Input.keysPrevious = {};
    Input.mouse = { x: 0, y: 0, pressed: false, button: -1 };
    Input.touch = { x: 0, y: 0, active: false };

    console.log('Input system cleaned up');
}

// Update input state (call once per frame before checking inputs)
function updateInput() {
    // Calculate which keys were just pressed this frame
    for (const key in Input.keys) {
        Input.keysJustPressed[key] = Input.keys[key] && !Input.keysPrevious[key];
    }
    // Store current state as previous for next frame
    Input.keysPrevious = { ...Input.keys };
}

// Helper functions
function isKeyPressed(key) {
    return Input.keys[key.toLowerCase()] === true;
}

// Check if key was just pressed this frame (not held)
function isKeyJustPressed(key) {
    return Input.keysJustPressed[key.toLowerCase()] === true;
}

function isMousePressed() {
    return Input.mouse.pressed;
}

function getMousePosition() {
    return { x: Input.mouse.x, y: Input.mouse.y };
}

function isTouchActive() {
    return Input.touch.active;
}

function getTouchPosition() {
    return { x: Input.touch.x, y: Input.touch.y };
}
