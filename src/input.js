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

// Initialize input handlers
function initInput(canvas) {
    // Keyboard input
    window.addEventListener('keydown', (e) => {
        Input.keys[e.key.toLowerCase()] = true;
    });

    window.addEventListener('keyup', (e) => {
        Input.keys[e.key.toLowerCase()] = false;
    });

    // Mouse input
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        Input.mouse.x = e.clientX - rect.left;
        Input.mouse.y = e.clientY - rect.top;
        Input.mouse.pressed = true;
        Input.mouse.button = e.button;
    });

    canvas.addEventListener('mouseup', () => {
        Input.mouse.pressed = false;
        Input.mouse.button = -1;
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        Input.mouse.x = e.clientX - rect.left;
        Input.mouse.y = e.clientY - rect.top;
    });

    // Touch input
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        Input.touch.x = touch.clientX - rect.left;
        Input.touch.y = touch.clientY - rect.top;
        Input.touch.active = true;
    });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        Input.touch.active = false;
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        Input.touch.x = touch.clientX - rect.left;
        Input.touch.y = touch.clientY - rect.top;
    });

    console.log('Input system initialized');
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
